import { Controller, Post, Body, BadRequestException, Inject, forwardRef } from "@nestjs/common";
import { ApiOperation, ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Recaptcha } from "@nestlab/google-recaptcha";

import { CurrentUser } from "@/common/user.decorator";
import { UserEntity } from "@/user/user.entity";
import { ProblemService, ProblemPermissionType } from "@/problem/problem.service";
import { UserService } from "@/user/user.service";
import { UserPrivilegeService, UserPrivilegeType } from "@/user/user-privilege.service";
import { ConfigService } from "@/config/config.service";
import { ProblemEntity } from "@/problem/problem.entity";
import { AuditLogObjectType, AuditService } from "@/audit/audit.service";
import { MinioSignFor, FileService } from "@/file/file.service";
import { ProblemTypeFactoryService } from "@/problem-type/problem-type-factory.service";
import { ContestService } from "@/contest/contest.service";

import { SubmissionStatus } from "./submission-status.enum";
import { SubmissionStatisticsService } from "./submission-statistics.service";
import { SubmissionProgressService } from "./submission-progress.service";
import { SubmissionProgressGateway, SubmissionProgressSubscriptionType } from "./submission-progress.gateway";
import { SubmissionPermissionType, SubmissionService } from "./submission.service";

import {
  SubmitRequestDto,
  SubmitResponseDto,
  SubmitResponseError,
  QuerySubmissionRequestDto,
  QuerySubmissionResponseDto,
  QuerySubmissionResponseError,
  SubmissionMetaDto,
  GetSubmissionDetailRequestDto,
  GetSubmissionDetailResponseDto,
  GetSubmissionDetailResponseError,
  DownloadSubmissionFileRequestDto,
  DownloadSubmissionFileResponseDto,
  DownloadSubmissionFileResponseError,
  QuerySubmissionStatisticsRequestDto,
  QuerySubmissionStatisticsResponseDto,
  QuerySubmissionStatisticsResponseError,
  RejudgeSubmissionRequestDto,
  RejudgeSubmissionResponseDto,
  RejudgeSubmissionResponseError,
  CancelSubmissionRequestDto,
  CancelSubmissionResponseDto,
  CancelSubmissionResponseError,
  SetSubmissionPublicRequestDto,
  SetSubmissionPublicResponseDto,
  SetSubmissionPublicResponseError,
  DeleteSubmissionRequestDto,
  DeleteSubmissionResponseDto,
  DeleteSubmissionResponseError
} from "./dto";

@ApiTags("Submission")
@Controller("submission")
export class SubmissionController {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly problemService: ProblemService,
    private readonly problemTypeFactoryService: ProblemTypeFactoryService,
    private readonly userService: UserService,
    private readonly userPrivilegeService: UserPrivilegeService,
    private readonly configService: ConfigService,
    private readonly submissionProgressGateway: SubmissionProgressGateway,
    private readonly submissionProgressService: SubmissionProgressService,
    private readonly submissionStatisticsService: SubmissionStatisticsService,
    private readonly auditService: AuditService,
    private readonly fileService: FileService,
    @Inject(forwardRef(() => ContestService))
    private readonly contestService: ContestService
  ) {}

  private hideTestCaseScores(result: any, originalStatus: SubmissionStatus, isAdmin: boolean): any {
    // Don't hide if status is CompilationError or RuntimeError
    if (originalStatus === SubmissionStatus.CompilationError || originalStatus === SubmissionStatus.RuntimeError) {
      return result;
    }

    // Deep clone and hide scores
    const hiddenResult = JSON.parse(JSON.stringify(result));

    const hideTestCase = (testcase: any) => {
      if (isAdmin) {
        // Admin can see real status with asterisk marker
        return {
          ...testcase,
          status: testcase.status ? testcase.status + "*" : "Hidden*",
          isHiddenForUsers: true
        };
      } else {
        // Normal users see Hidden
        return {
          ...testcase,
          score: null,
          status: "Hidden"
        };
      }
    };

    // Hide samples
    if (hiddenResult.samples) {
      hiddenResult.samples = hiddenResult.samples.map(hideTestCase);
    }

    // Hide testcases
    if (hiddenResult.testcases) {
      hiddenResult.testcases = hiddenResult.testcases.map(hideTestCase);
    }

    // Hide subtasks
    if (hiddenResult.subtasks) {
      hiddenResult.subtasks = hiddenResult.subtasks.map(subtask => ({
        ...subtask,
        score: isAdmin ? subtask.score : null,
        testcases: subtask.testcases.map(hideTestCase)
      }));
    }

    return hiddenResult;
  }

  @Recaptcha()
  @ApiOperation({
    summary: "Submit code to a problem.",
    description: "Recaptcha required."
  })
  @ApiBearerAuth()
  @Post("submit")
  async submit(@CurrentUser() currentUser: UserEntity, @Body() request: SubmitRequestDto): Promise<SubmitResponseDto> {
    if (!currentUser)
      return {
        error: SubmitResponseError.PERMISSION_DENIED
      };

    return await this.problemService.lockProblemById<SubmitResponseDto>(request.problemId, "Read", async problem => {
      if (!problem)
        return {
          error: SubmitResponseError.NO_SUCH_PROBLEM
        };

      // Check if submitting through a contest context
      let hasContestAccess = false;
      if (request.contestId != null) {
        const contest = await this.contestService.findContestById(request.contestId);
        if (contest) {
          // Check if the problem is in the contest
          const isProblemInContest = await this.contestService.isProblemInContest(request.contestId, problem.id);
          if (isProblemInContest) {
            // Check if user is registered for the contest
            const isRegistered = await this.contestService.isUserRegisteredForContest(request.contestId, currentUser.id);
            if (isRegistered) {
              hasContestAccess = true;
            }
          }
        }
      }

      // If not submitting through contest or doesn't have contest access, check normal problem permissions
      if (!hasContestAccess && !(await this.problemService.userHasPermission(currentUser, problem, ProblemPermissionType.View)))
        return {
          error: SubmitResponseError.PERMISSION_DENIED
        };

      const [, submittable] = await this.problemService.getProblemJudgeInfo(problem);
      if (!submittable)
        return {
          error: SubmitResponseError.PERMISSION_DENIED
        };

      const [validationError, fileErrorOrUploadRequest, submission] = await this.submissionService.createSubmission(
        currentUser,
        problem,
        request.content,
        request.uploadInfo,
        request.contestId
      );

      if (validationError && validationError.length > 0) throw new BadRequestException(validationError);

      // If file upload is required
      if (typeof fileErrorOrUploadRequest === "string")
        return {
          error: fileErrorOrUploadRequest as SubmitResponseError
        };
      else if (fileErrorOrUploadRequest)
        return {
          signedUploadRequest: fileErrorOrUploadRequest
        };

      // Submitted successfully
      return {
        submissionId: submission.id
      };
    });
  }

  @ApiOperation({
    summary: "Query the submissions."
  })
  @ApiBearerAuth()
  @Post("querySubmission")
  async querySubmission(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: QuerySubmissionRequestDto
  ): Promise<QuerySubmissionResponseDto> {
    let filterProblem: ProblemEntity = null;
    if (request.problemId || request.problemDisplayId) {
      filterProblem = request.problemId
        ? await this.problemService.findProblemById(request.problemId)
        : await this.problemService.findProblemByDisplayId(request.problemDisplayId);
      if (!filterProblem)
        return {
          error: QuerySubmissionResponseError.NO_SUCH_PROBLEM
        };
    }

    let filterSubmitter: UserEntity = null;
    if (request.submitter) {
      filterSubmitter = await this.userService.findUserByUsername(request.submitter);
      if (!filterSubmitter)
        return {
          error: QuerySubmissionResponseError.NO_SUCH_USER
        };
    }

    const hasManageProblemPrivilege = await this.userPrivilegeService.userHasPrivilege(
      currentUser,
      UserPrivilegeType.ManageProblem
    );
    const hasViewProblemPermission =
      hasManageProblemPrivilege ||
      (filterProblem &&
        (await this.problemService.userHasPermission(currentUser, filterProblem, ProblemPermissionType.View)));
    const isSubmissionsOwned = filterSubmitter && currentUser && filterSubmitter.id === currentUser.id;
    const queryResult = await this.submissionService.querySubmissions(
      filterProblem ? filterProblem.id : null,
      filterSubmitter ? filterSubmitter.id : null,
      request.codeLanguage,
      request.status,
      request.minId,
      request.maxId,
      !(hasManageProblemPrivilege || hasViewProblemPermission || isSubmissionsOwned),
      request.takeCount > this.configService.config.queryLimit.submissions
        ? this.configService.config.queryLimit.submissions
        : request.takeCount,
      request.contestId
    );

    const submissionMetas: SubmissionMetaDto[] = new Array(queryResult.result.length);
    const uniqueContestIds = [...new Set(queryResult.result.map(s => s.contestId).filter(id => id != null))];
    const [problems, submitters, contests] = await Promise.all([
      this.problemService.findProblemsByExistingIds(queryResult.result.map(submission => submission.problemId)),
      this.userService.findUsersByExistingIds(queryResult.result.map(submission => submission.submitterId)),
      uniqueContestIds.length > 0
        ? Promise.all(uniqueContestIds.map(id => this.contestService.findContestById(id)))
        : Promise.resolve([])
    ]);
    const contestMap = new Map(contests.filter(c => c).map(c => [c.id, c]));
    const pendingSubmissionIds: number[] = [];
    await Promise.all(
      queryResult.result.map(async (_, i) => {
        const submission = queryResult.result[i];
        const titleLocale = problems[i].locales.includes(request.locale) ? request.locale : problems[i].locales[0];

        // Check if this submission should have its score/status hidden (OI contest during competition)
        let shouldHideScore = false;
        if (submission.contestId) {
          const contest = contestMap.get(submission.contestId);
          if (contest && contest.type === "OI") {
            const now = new Date();
            const endTime = new Date(contest.endTime);
            if (now < endTime) {
              shouldHideScore = true;
            }
          }
        }

        submissionMetas[i] = {
          id: submission.id,
          isPublic: submission.isPublic,
          codeLanguage: submission.codeLanguage,
          answerSize: submission.answerSize,
          score: shouldHideScore ? null : submission.score,
          status: shouldHideScore ? ("Hidden" as any) : submission.status,
          submitTime: submission.submitTime,
          problem: await this.problemService.getProblemMeta(problems[i]),
          problemTitle: await this.problemService.getProblemLocalizedTitle(problems[i], titleLocale),
          submitter: await this.userService.getUserMeta(submitters[i], currentUser),
          timeUsed: shouldHideScore ? null : submission.timeUsed,
          memoryUsed: shouldHideScore ? null : submission.memoryUsed,
          contestId: submission.contestId,
          contestTitle: submission.contestId ? contestMap.get(submission.contestId)?.title : undefined
        };

        // For progress reporting
        const progress =
          submission.status === SubmissionStatus.Pending &&
          (await this.submissionProgressService.getPendingSubmissionProgress(submission.id));

        if (progress) {
          submissionMetas[i].progressType = progress.progressType;
        }

        if (submission.status === SubmissionStatus.Pending) {
          pendingSubmissionIds.push(submission.id);
        }
      })
    );

    return {
      submissions: submissionMetas,
      progressSubscriptionKey:
        pendingSubmissionIds.length === 0
          ? null
          : this.submissionProgressGateway.encodeSubscription({
              type: SubmissionProgressSubscriptionType.Meta,
              submissionIds: pendingSubmissionIds
            }),
      hasSmallerId: queryResult.hasSmallerId,
      hasLargerId: queryResult.hasLargerId
    };
  }

  @ApiOperation({
    summary: "Get the meta, content and result of a submission."
  })
  @ApiBearerAuth()
  @Post("getSubmissionDetail")
  async getSubmissionDetail(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: GetSubmissionDetailRequestDto
  ): Promise<GetSubmissionDetailResponseDto> {
    const submission = await this.submissionService.findSubmissionById(Number(request.submissionId));
    if (!submission)
      return {
        error: GetSubmissionDetailResponseError.NO_SUCH_SUBMISSION
      };

    const [problem, hasPrivilege] = await Promise.all([
      this.problemService.findProblemById(submission.problemId),
      this.userPrivilegeService.userHasPrivilege(currentUser, UserPrivilegeType.ManageProblem)
    ]);

    if (
      !(await this.submissionService.userHasPermission(
        currentUser,
        submission,
        SubmissionPermissionType.View,
        problem,
        hasPrivilege
      ))
    )
      return {
        error: GetSubmissionDetailResponseError.PERMISSION_DENIED
      };
    const titleLocale = problem.locales.includes(request.locale) ? request.locale : problem.locales[0];
    const pending = submission.status === SubmissionStatus.Pending;

    const [
      submitter,
      submissionDetail,
      progress,
      permissionRejudge,
      permissionCancel,
      permissionSetPublic,
      permissionDelete,
      contest
    ] = await Promise.all([
      this.userService.findUserById(submission.submitterId),
      this.submissionService.getSubmissionDetail(submission),
      pending && this.submissionProgressService.getPendingSubmissionProgress(submission.id),
      this.submissionService.userHasPermission(
        currentUser,
        submission,
        SubmissionPermissionType.Rejudge,
        problem,
        hasPrivilege
      ),
      this.submissionService.userHasPermission(
        currentUser,
        submission,
        SubmissionPermissionType.Cancel,
        problem,
        hasPrivilege
      ),
      this.submissionService.userHasPermission(
        currentUser,
        submission,
        SubmissionPermissionType.ManagePublicness,
        problem,
        hasPrivilege
      ),
      this.submissionService.userHasPermission(
        currentUser,
        submission,
        SubmissionPermissionType.Delete,
        problem,
        hasPrivilege
      ),
      submission.contestId ? this.contestService.findContestById(submission.contestId) : Promise.resolve(null)
    ]);

    // Check if this submission should have its score/status hidden (OI contest during competition)
    let shouldHideScore = false;
    if (submission.contestId && contest && contest.type === "OI") {
      const now = new Date();
      const endTime = new Date(contest.endTime);
      if (now < endTime) {
        shouldHideScore = true;
      }
    }

    // Determine if current user is admin
    const isAdmin = currentUser && (currentUser.isAdmin || hasPrivilege);

    // Hide test case scores in result if needed
    let processedResult = submissionDetail.result;
    if (shouldHideScore && processedResult) {
      processedResult = this.hideTestCaseScores(processedResult, submission.status, isAdmin);
    }

    // Check if user can view the code content
    // Only the submitter or admins can view the code
    const canViewCode = currentUser && (currentUser.id === submission.submitterId || isAdmin);

    return {
      meta: {
        id: submission.id,
        isPublic: submission.isPublic,
        codeLanguage: submission.codeLanguage,
        answerSize: submission.answerSize,
        score: shouldHideScore && !isAdmin ? null : submission.score,
        status: shouldHideScore && !isAdmin ? ("Hidden" as any) : submission.status,
        submitTime: submission.submitTime,
        problem: await this.problemService.getProblemMeta(problem),
        problemTitle: await this.problemService.getProblemLocalizedTitle(problem, titleLocale),
        submitter: await this.userService.getUserMeta(submitter, currentUser),
        timeUsed: shouldHideScore && !isAdmin ? null : submission.timeUsed,
        memoryUsed: shouldHideScore && !isAdmin ? null : submission.memoryUsed,
        contestId: submission.contestId,
        contestTitle: contest?.title
      },
      content: canViewCode ? submissionDetail.content : null,
      progress: progress || processedResult,
      progressSubscriptionKey: !pending
        ? null
        : this.submissionProgressGateway.encodeSubscription({
            type: SubmissionProgressSubscriptionType.Detail,
            submissionIds: [submission.id]
          }),
      permissionRejudge,
      permissionCancel,
      permissionSetPublic,
      permissionDelete
    };
  }

  @ApiOperation({
    summary: "Get the meta, content and result of a submission."
  })
  @ApiBearerAuth()
  @Post("downloadSubmissionFile")
  async downloadSubmissionFile(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: DownloadSubmissionFileRequestDto
  ): Promise<DownloadSubmissionFileResponseDto> {
    const submission = await this.submissionService.findSubmissionById(request.submissionId);
    if (!submission)
      return {
        error: DownloadSubmissionFileResponseError.NO_SUCH_SUBMISSION
      };

    if (!(await this.submissionService.userHasPermission(currentUser, submission, SubmissionPermissionType.View)))
      return {
        error: DownloadSubmissionFileResponseError.PERMISSION_DENIED
      };

    const submissionDetail = await this.submissionService.getSubmissionDetail(submission);
    if (!submissionDetail.fileUuid)
      return {
        error: DownloadSubmissionFileResponseError.NO_SUCH_FILE
      };

    return {
      url: await this.fileService.signDownloadLink({
        uuid: submissionDetail.fileUuid,
        downloadFilename: request.filename,
        signFor: MinioSignFor.UserDownload
      })
    };
  }

  @ApiOperation({
    summary: "Query a problem's submission statistics, i.e. the ranklist of each user's best submissions"
  })
  @ApiBearerAuth()
  @Post("querySubmissionStatistics")
  async querySubmissionStatistics(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: QuerySubmissionStatisticsRequestDto
  ): Promise<QuerySubmissionStatisticsResponseDto> {
    if (request.takeCount > this.configService.config.queryLimit.submissionStatistics)
      return {
        error: QuerySubmissionStatisticsResponseError.TAKE_TOO_MANY
      };

    let problem: ProblemEntity;
    if (request.problemId) problem = await this.problemService.findProblemById(request.problemId);
    if (request.problemDisplayId) problem = await this.problemService.findProblemByDisplayId(request.problemDisplayId);
    if (!problem)
      return {
        error: QuerySubmissionStatisticsResponseError.NO_SUCH_PROBLEM
      };

    if (
      !this.problemTypeFactoryService.type(problem.type).enableStatistics() ||
      !(await this.problemService.userHasPermission(currentUser, problem, ProblemPermissionType.View))
    )
      return {
        error: QuerySubmissionStatisticsResponseError.PERMISSION_DENIED
      };

    const titleLocale = problem.locales.includes(request.locale) ? request.locale : problem.locales[0];

    const [[submissions, count], scores, problemTitle] = await Promise.all([
      this.submissionStatisticsService.querySubmissionStatisticsAndCount(
        problem,
        request.statisticsType,
        request.skipCount,
        request.takeCount
      ),
      this.submissionStatisticsService.querySubmissionScoreStatistics(problem),
      this.problemService.getProblemLocalizedTitle(problem, titleLocale)
    ]);

    const submissionMetas: SubmissionMetaDto[] = new Array(submissions.length);
    const submitters = await this.userService.findUsersByExistingIds(
      submissions.map(submission => submission.submitterId)
    );

    await Promise.all(
      submissions.map(async (submission, i) => {
        submissionMetas[i] = {
          id: submission.id,
          isPublic: submission.isPublic,
          codeLanguage: submission.codeLanguage,
          answerSize: submission.answerSize,
          score: submission.score,
          status: submission.status,
          submitTime: submission.submitTime,
          problem: await this.problemService.getProblemMeta(problem),
          problemTitle,
          submitter: await this.userService.getUserMeta(submitters[i], currentUser),
          timeUsed: submission.timeUsed,
          memoryUsed: submission.memoryUsed
        };
      })
    );

    return {
      submissions: submissionMetas,
      scores,
      count
    };
  }

  @ApiOperation({
    summary: "Rejudge a submission."
  })
  @ApiBearerAuth()
  @Post("rejudgeSubmission")
  async rejudgeSubmission(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: RejudgeSubmissionRequestDto
  ): Promise<RejudgeSubmissionResponseDto> {
    if (!currentUser)
      return {
        error: RejudgeSubmissionResponseError.PERMISSION_DENIED
      };

    const submission = await this.submissionService.findSubmissionById(request.submissionId);
    if (!submission)
      return {
        error: RejudgeSubmissionResponseError.NO_SUCH_SUBMISSION
      };

    if (!(await this.submissionService.userHasPermission(currentUser, submission, SubmissionPermissionType.Rejudge)))
      return {
        error: RejudgeSubmissionResponseError.PERMISSION_DENIED
      };

    const isPreviouslyPending = !!submission.taskId;
    const previousStatus = submission.status;
    const previousScore = submission.score;

    await this.submissionService.rejudgeSubmission(submission);

    await this.auditService.log("submission.rejudge", AuditLogObjectType.Submission, submission.id, {
      isPreviouslyPending,
      previousStatus,
      previousScore
    });

    return {};
  }

  @ApiOperation({
    summary:
      "Cancel a submission if it is running. Cancel a non-running submission will result in not error and no effect."
  })
  @ApiBearerAuth()
  @Post("cancelSubmission")
  async cancelSubmission(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: CancelSubmissionRequestDto
  ): Promise<CancelSubmissionResponseDto> {
    if (!currentUser)
      return {
        error: CancelSubmissionResponseError.PERMISSION_DENIED
      };

    const submission = await this.submissionService.findSubmissionById(request.submissionId);
    if (!submission)
      return {
        error: CancelSubmissionResponseError.NO_SUCH_SUBMISSION
      };

    if (!(await this.submissionService.userHasPermission(currentUser, submission, SubmissionPermissionType.Cancel)))
      return {
        error: CancelSubmissionResponseError.PERMISSION_DENIED
      };

    const { taskId } = submission;

    await this.submissionService.cancelSubmission(submission);

    await this.auditService.log("submission.cancel", AuditLogObjectType.Submission, submission.id, {
      taskId
    });

    return {};
  }

  @ApiOperation({
    summary: "Set if a submission is public or not."
  })
  @ApiBearerAuth()
  @Post("setSubmissionPublic")
  async setSubmissionPublic(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: SetSubmissionPublicRequestDto
  ): Promise<SetSubmissionPublicResponseDto> {
    if (!currentUser)
      return {
        error: SetSubmissionPublicResponseError.PERMISSION_DENIED
      };

    const submission = await this.submissionService.findSubmissionById(request.submissionId);
    if (!submission)
      return {
        error: SetSubmissionPublicResponseError.NO_SUCH_SUBMISSION
      };

    if (
      !(await this.submissionService.userHasPermission(
        currentUser,
        submission,
        SubmissionPermissionType.ManagePublicness
      ))
    )
      return {
        error: SetSubmissionPublicResponseError.PERMISSION_DENIED
      };

    if (submission.isPublic === request.isPublic) return {};
    await this.submissionService.setSubmissionPublic(submission, request.isPublic);

    await this.auditService.log(
      request.isPublic ? "submission.set_public" : "submission.set_non_public",
      AuditLogObjectType.Submission,
      submission.id
    );

    return {};
  }

  @ApiOperation({
    summary: "Delete a submission."
  })
  @ApiBearerAuth()
  @Post("deleteSubmission")
  async deleteSubmission(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: DeleteSubmissionRequestDto
  ): Promise<DeleteSubmissionResponseDto> {
    if (!currentUser)
      return {
        error: DeleteSubmissionResponseError.PERMISSION_DENIED
      };

    const submission = await this.submissionService.findSubmissionById(request.submissionId);
    if (!submission)
      return {
        error: DeleteSubmissionResponseError.NO_SUCH_SUBMISSION
      };

    if (!(await this.submissionService.userHasPermission(currentUser, submission, SubmissionPermissionType.Delete)))
      return {
        error: DeleteSubmissionResponseError.PERMISSION_DENIED
      };

    const submissionDetail = await this.submissionService.getSubmissionDetail(submission);

    await this.submissionService.deleteSubmission(submission);

    await this.auditService.log("submission.delete", AuditLogObjectType.Submission, submission.id, {
      problemId: submission.problemId,
      submitterId: submission.submitterId,
      submissionContent: submissionDetail.content
    });

    return {};
  }
}

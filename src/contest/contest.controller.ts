import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

import { CurrentUser } from "@/common/user.decorator";
import { UserEntity } from "@/user/user.entity";

import { ContestService } from "./contest.service";

import {
  GetContestListRequestDto,
  GetContestListResponseDto,
  GetContestDetailRequestDto,
  GetContestDetailResponseDto,
  GetContestDetailResponseError,
  CreateContestRequestDto,
  CreateContestResponseDto,
  CreateContestResponseError,
  UpdateContestRequestDto,
  UpdateContestResponseDto,
  UpdateContestResponseError,
  DeleteContestRequestDto,
  DeleteContestResponseDto,
  DeleteContestResponseError,
  GetContestRanklistRequestDto,
  GetContestRanklistResponseDto,
  GetContestRanklistResponseError,
  RegisterContestRequestDto,
  RegisterContestResponseDto,
  RegisterContestResponseError,
  UnregisterContestRequestDto,
  UnregisterContestResponseDto,
  UnregisterContestResponseError,
  CalculateContestRatingRequestDto,
  CalculateContestRatingResponseDto,
  CalculateContestRatingResponseError
} from "./dto";

@ApiTags("Contest")
@Controller("contest")
export class ContestController {
  constructor(private readonly contestService: ContestService) {}

  @Post("getContestList")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get contest list with pagination." })
  async getContestList(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: GetContestListRequestDto
  ): Promise<GetContestListResponseDto> {
    const [contests, count] = await this.contestService.getContestList(
      request.skipCount,
      request.takeCount,
      currentUser
    );

    const contestMetas = await Promise.all(contests.map(contest => this.contestService.getContestMeta(contest)));

    return {
      contests: contestMetas,
      count
    };
  }

  @Post("getContestDetail")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get contest details including problems." })
  async getContestDetail(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: GetContestDetailRequestDto
  ): Promise<GetContestDetailResponseDto> {
    const contest = await this.contestService.findContestById(request.contestId);
    if (!contest)
      return {
        error: GetContestDetailResponseError.NO_SUCH_CONTEST
      };

    const canView = await this.contestService.checkPermissionToView(contest, currentUser);
    if (!canView)
      return {
        error: GetContestDetailResponseError.PERMISSION_DENIED
      };

    const owner = await contest.owner;
    const problems = await this.contestService.getContestProblems(contest.id);
    const hasPermissionToManage = await this.contestService.checkPermissionToManage(contest, currentUser);
    const isRegistered = currentUser
      ? await this.contestService.isUserRegisteredForContest(contest.id, currentUser.id)
      : false;

    return {
      id: contest.id,
      title: contest.title,
      description: contest.description,
      startTime: contest.startTime,
      endTime: contest.endTime,
      type: contest.type,
      isPublic: contest.isPublic,
      announcement: contest.announcement,
      editorial: contest.editorial,
      ownerId: contest.ownerId,
      ownerUsername: owner.username,
      ownerRating: owner.rating,
      createTime: contest.createTime,
      problems,
      hasPermissionToManage,
      isRegistered
    };
  }

  @Post("createContest")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new contest (admin only)." })
  async createContest(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: CreateContestRequestDto
  ): Promise<CreateContestResponseDto> {
    if (!currentUser || !currentUser.isAdmin)
      return {
        error: CreateContestResponseError.PERMISSION_DENIED
      };

    const startTime = new Date(request.startTime);
    const endTime = new Date(request.endTime);

    if (startTime >= endTime)
      return {
        error: CreateContestResponseError.INVALID_TIME_RANGE
      };

    const problemsExist = await this.contestService.checkProblemsExist(request.problemIds);
    if (!problemsExist)
      return {
        error: CreateContestResponseError.NO_SUCH_PROBLEM
      };

    const contest = await this.contestService.createContest(
      request.title,
      request.description,
      startTime,
      endTime,
      request.type,
      request.isPublic,
      request.announcement,
      request.editorial,
      currentUser.id,
      request.problemIds
    );

    return {
      contestId: contest.id
    };
  }

  @Post("updateContest")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update contest information (admin or owner)." })
  async updateContest(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: UpdateContestRequestDto
  ): Promise<UpdateContestResponseDto> {
    const contest = await this.contestService.findContestById(request.contestId);
    if (!contest)
      return {
        error: UpdateContestResponseError.NO_SUCH_CONTEST
      };

    const hasPermission = await this.contestService.checkPermissionToManage(contest, currentUser);
    if (!hasPermission)
      return {
        error: UpdateContestResponseError.PERMISSION_DENIED
      };

    const startTime = request.startTime ? new Date(request.startTime) : undefined;
    const endTime = request.endTime ? new Date(request.endTime) : undefined;

    if (startTime && endTime && startTime >= endTime)
      return {
        error: UpdateContestResponseError.INVALID_TIME_RANGE
      };

    if (request.problemIds) {
      const problemsExist = await this.contestService.checkProblemsExist(request.problemIds);
      if (!problemsExist)
        return {
          error: UpdateContestResponseError.NO_SUCH_PROBLEM
        };
    }

    await this.contestService.updateContest(contest, {
      title: request.title,
      description: request.description,
      startTime,
      endTime,
      type: request.type,
      isPublic: request.isPublic,
      announcement: request.announcement,
      editorial: request.editorial,
      problemIds: request.problemIds
    });

    return {};
  }

  @Post("deleteContest")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a contest (admin only)." })
  async deleteContest(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: DeleteContestRequestDto
  ): Promise<DeleteContestResponseDto> {
    if (!currentUser || !currentUser.isAdmin)
      return {
        error: DeleteContestResponseError.PERMISSION_DENIED
      };

    const contest = await this.contestService.findContestById(request.contestId);
    if (!contest)
      return {
        error: DeleteContestResponseError.NO_SUCH_CONTEST
      };

    await this.contestService.deleteContest(contest);

    return {};
  }

  @Post("getContestRanklist")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get contest ranklist." })
  async getContestRanklist(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: GetContestRanklistRequestDto
  ): Promise<GetContestRanklistResponseDto> {
    const contest = await this.contestService.findContestById(request.contestId);
    if (!contest)
      return {
        error: GetContestRanklistResponseError.NO_SUCH_CONTEST
      };

    const canView = await this.contestService.checkPermissionToView(contest, currentUser);
    if (!canView)
      return {
        error: GetContestRanklistResponseError.PERMISSION_DENIED
      };

    const ranklist = await this.contestService.getContestRanklist(contest.id);
    const problemIds = await this.contestService.getProblemIdsByContestId(contest.id);

    return {
      contestTitle: contest.title,
      contestType: contest.type,
      ranklist,
      problemIds
    };
  }

  @Post("registerContest")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Register for a contest." })
  async registerContest(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: RegisterContestRequestDto
  ): Promise<RegisterContestResponseDto> {
    if (!currentUser)
      return {
        error: RegisterContestResponseError.PERMISSION_DENIED
      };

    const contest = await this.contestService.findContestById(request.contestId);
    if (!contest)
      return {
        error: RegisterContestResponseError.NO_SUCH_CONTEST
      };

    const canView = await this.contestService.checkPermissionToView(contest, currentUser);
    if (!canView)
      return {
        error: RegisterContestResponseError.PERMISSION_DENIED
      };

    // Check if already registered
    const isRegistered = await this.contestService.isUserRegisteredForContest(contest.id, currentUser.id);
    if (isRegistered)
      return {
        error: RegisterContestResponseError.ALREADY_REGISTERED
      };

    // Register user
    await this.contestService.registerUserForContest(contest, currentUser);

    return {};
  }

  @Post("unregisterContest")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Unregister from a contest." })
  async unregisterContest(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: UnregisterContestRequestDto
  ): Promise<UnregisterContestResponseDto> {
    if (!currentUser)
      return {
        error: UnregisterContestResponseError.PERMISSION_DENIED
      };

    const contest = await this.contestService.findContestById(request.contestId);
    if (!contest)
      return {
        error: UnregisterContestResponseError.NO_SUCH_CONTEST
      };

    // Check if registered
    const isRegistered = await this.contestService.isUserRegisteredForContest(contest.id, currentUser.id);
    if (!isRegistered)
      return {
        error: UnregisterContestResponseError.NOT_REGISTERED
      };

    // Check if contest has started
    if (new Date() >= contest.startTime)
      return {
        error: UnregisterContestResponseError.CONTEST_STARTED
      };

    // Unregister user
    await this.contestService.unregisterUserFromContest(contest.id, currentUser.id);

    return {};
  }

  @Post("calculateContestRating")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Calculate rating changes for a contest (admin only)." })
  async calculateContestRating(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: CalculateContestRatingRequestDto
  ): Promise<CalculateContestRatingResponseDto> {
    // Check if user is admin
    if (!currentUser || !currentUser.isAdmin) {
      return {
        error: CalculateContestRatingResponseError.PERMISSION_DENIED
      };
    }

    // Get contest
    const contest = await this.contestService.findContestById(request.contestId);
    if (!contest) {
      return {
        error: CalculateContestRatingResponseError.NO_SUCH_CONTEST
      };
    }

    // Check if contest has ended
    const now = new Date();
    if (now < contest.endTime) {
      return {
        error: CalculateContestRatingResponseError.CONTEST_NOT_ENDED
      };
    }

    // Calculate ratings
    await this.contestService.calculateContestRatings(contest, request.recalculate || false);

    return {};
  }
}

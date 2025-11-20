import { Module, Global } from "@nestjs/common";

import { GoogleRecaptchaModule } from "@nestlab/google-recaptcha";

import { ConfigModule } from "./config/config.module";
import { ConfigService } from "./config/config.service";
import { SettingsModule } from "./settings/settings.module";
import { RequestWithSession } from "./auth/auth.middleware";

const sharedModules = [
  ConfigModule,
  SettingsModule,
  GoogleRecaptchaModule.forRootAsync({
    imports: [ConfigModule],
    useFactory: (configService: ConfigService) => ({
      secretKey: configService.config.security.recaptcha.secretKey || "dummy-key-when-disabled",
      response: (req: RequestWithSession) => String(req.headers["x-recaptcha-token"]),
      skipIf: async (req: unknown) => {
        const request = req as RequestWithSession;
        return (
          !configService.config.preference.security.recaptchaEnabled ||
          (String(request.headers["x-recaptcha-token"]).toLowerCase() === "skip" &&
            (await request.session?.userCanSkipRecaptcha?.()))
        );
      }
    }),
    inject: [ConfigService]
  })
];

@Global()
@Module({
  imports: sharedModules,
  exports: sharedModules
})
export class SharedModule {}

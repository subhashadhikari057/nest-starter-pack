import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OtpSmsService } from "./otp.service";

@Global()
@Module({
	imports: [ConfigModule],
	providers: [OtpSmsService],
	exports: [OtpSmsService],
})
export class OtpModule {}

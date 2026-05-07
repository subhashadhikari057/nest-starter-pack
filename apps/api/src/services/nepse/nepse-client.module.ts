import { Global, Module } from "@nestjs/common";
import { NepseClientService } from "./nepse-client.service";

@Global()
@Module({
	providers: [NepseClientService],
	exports: [NepseClientService],
})
export class NepseClientModule {}

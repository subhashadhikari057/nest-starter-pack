import { Global, Module } from "@nestjs/common";
import { ActivityController } from "./activity.controller";
import { ActivityService } from "./activity.service";
import { ActivityRecordService } from "./activity-record.service";

@Global()
@Module({
	imports: [],
	controllers: [ActivityController],
	providers: [ActivityService, ActivityRecordService],
	exports: [ActivityService, ActivityRecordService],
})
export class ActivityModule {}

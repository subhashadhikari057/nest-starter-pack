import { Module } from "@nestjs/common";
import { CustomersModule } from "./customers/customers.module";
import { TeamModule } from "./team/team.module";

@Module({
	imports: [CustomersModule, TeamModule],
	exports: [CustomersModule, TeamModule],
})
export class UsersModule {}

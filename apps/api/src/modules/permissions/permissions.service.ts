import { permission } from "@bullhouse/db";
import { Inject, Injectable } from "@nestjs/common";
import { asc } from "drizzle-orm";
import { DATABASE, Database } from "@/database/database.module";

@Injectable()
export class PermissionsService {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findAll() {
		const permissions = await this.db.query.permission.findMany({
			orderBy: [asc(permission.module), asc(permission.action)],
		});

		// Group permissions by module
		const groupedByModule = permissions.reduce(
			(acc, p) => {
				if (!acc[p.module]) {
					acc[p.module] = [];
				}
				acc[p.module].push(p);
				return acc;
			},
			{} as Record<string, typeof permissions>,
		);

		return groupedByModule;
	}
}

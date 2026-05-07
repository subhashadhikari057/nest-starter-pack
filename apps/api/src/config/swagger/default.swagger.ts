import type { INestApplication } from "@nestjs/common";

import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AuthModule } from "@/modules/auth/auth.module";
import { NotificationModule } from "@/modules/notification/notification.module";
import { PermissionsModule } from "@/modules/permissions/permissions.module";
import { RoleModule } from "@/modules/role/role.module";
import { RolePermissionsModule } from "@/modules/role-permissions/role-permissions.module";
import { UsersModule } from "@/modules/users/users.module";
import { ActivityModule } from "@/services/activity/activity.module";
import { filterSwaggerPaths, mountScalarDocsWithJson } from "./swagger.shared";

export const configureDefaultSwagger = (app: INestApplication): void => {
	const baseUrl =
		process.env.API_PUBLIC_BASE_URL ||
		`http://localhost:${process.env.PORT || 3003}`;
	const mainConfig = new DocumentBuilder()
		.setTitle("Bullhouse Admin API")
		.setDescription("Admin specific endpoints for the bullhouse application.")
		.setVersion("1.0")
		.addServer(baseUrl)
		.addBearerAuth()
		.build();

	const mainDocument = SwaggerModule.createDocument(app, mainConfig, {
		include: [
			AuthModule,
			UsersModule,
			RoleModule,
			PermissionsModule,
			RolePermissionsModule,
			NotificationModule,
			ActivityModule,
		],
	});

	filterSwaggerPaths(
		mainDocument,
		(path) =>
			!path.startsWith("/api/mobile") &&
			!path.startsWith("/mobile") &&
			!/^\/api\/v\d+\/mobile/.test(path),
	);

	mountScalarDocsWithJson(app, {
		docsPath: "/api/api-docs",
		jsonPath: "/api/api-docs/openapi.json",
		document: mainDocument,
		pageTitle: "Bullhouse Admin API",
		theme: "kepler",
		disableJsonPath: true,
	});
};

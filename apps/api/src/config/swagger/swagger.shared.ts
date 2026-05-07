import type { INestApplication } from "@nestjs/common";
import type { Request, Response } from "express";

import { SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { SwaggerTheme, SwaggerThemeNameEnum } from "swagger-themes";

export const SWAGGER_FAVICON = "../../assets/logo.jpg";

type SwaggerDocument = ReturnType<typeof SwaggerModule.createDocument>;

type ScalarSwaggerRouteOptions = {
	docsPath: string;
	jsonPath?: string;
	document: SwaggerDocument;
	pageTitle: string;
	theme: "kepler" | "deepSpace";
	disableJsonPath?: boolean;
};

export const getSwaggerThemeCss = (): string => {
	const theme = new SwaggerTheme();
	return theme.getBuffer(SwaggerThemeNameEnum.DARK);
};

export const filterSwaggerPaths = (
	doc: SwaggerDocument,
	predicate: (path: string) => boolean,
): void => {
	for (const path of Object.keys(doc.paths)) {
		if (!predicate(path)) {
			delete doc.paths[path];
		}
	}
};

export const mountScalarDocsWithJson = (
	app: Pick<INestApplication, "use">,
	{
		docsPath,
		jsonPath,
		document,
		pageTitle,
		theme,
		disableJsonPath,
	}: ScalarSwaggerRouteOptions,
): void => {
	if (!disableJsonPath && jsonPath) {
		app.use(jsonPath, (_req: Request, res: Response) => {
			res.type("application/json").send(document);
		});
	}

	app.use(
		docsPath,
		apiReference({
			spec: {
				content: document,
			},
			pageTitle,
			favicon: SWAGGER_FAVICON,
			hideModels: true,
			hideClientButton: true,
			showDeveloperTools: "never",
			persistAuth: true,
			telemetry: false,
			searchHotKey: "k",
			theme,
			documentDownloadType: "yaml",
		}),
	);
};

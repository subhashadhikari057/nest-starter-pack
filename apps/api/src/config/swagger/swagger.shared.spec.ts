import type { INestApplication } from "@nestjs/common";
import type { Request, Response } from "express";

import { apiReference } from "@scalar/nestjs-api-reference";
import { mountScalarDocsWithJson } from "./swagger.shared";

jest.mock("@scalar/nestjs-api-reference", () => ({
	apiReference: jest.fn(),
}));

describe("mountScalarDocsWithJson", () => {
	it("registers raw OpenAPI JSON and Scalar UI routes", () => {
		const scalarMiddleware = jest.fn();
		(apiReference as jest.Mock).mockReturnValue(scalarMiddleware);

		const use = jest.fn();
		const app = {
			use,
		} as unknown as Pick<INestApplication, "use">;

		const document = {
			openapi: "3.1.0",
			paths: {
				"/api/orders": {},
			},
		};

		mountScalarDocsWithJson(app, {
			docsPath: "/api/api-docs",
			jsonPath: "/api/api-docs/openapi.json",
			document: document as any,
			pageTitle: "Bullhouse Admin API",
			theme: "kepler",
		});

		expect(use).toHaveBeenNthCalledWith(
			1,
			"/api/api-docs/openapi.json",
			expect.any(Function),
		);
		expect(use).toHaveBeenNthCalledWith(2, "/api/api-docs", scalarMiddleware);

		expect(apiReference).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: {
					content: document,
				},
				pageTitle: "Bullhouse Admin API",
				theme: "kepler",
				documentDownloadType: "yaml",
			}),
		);
	});

	it("returns JSON with application/json content type", () => {
		const use = jest.fn();
		const app = {
			use,
		} as unknown as Pick<INestApplication, "use">;

		const document = {
			openapi: "3.1.0",
			paths: {},
		};

		mountScalarDocsWithJson(app, {
			docsPath: "/api/mobile-docs",
			jsonPath: "/api/mobile-docs/openapi.json",
			document: document as any,
			pageTitle: "Bullhouse Mobile API",
			theme: "deepSpace",
		});

		const jsonRouteHandler = use.mock.calls[0]?.[1] as (
			req: Request,
			res: Response,
		) => void;
		const response = {
			type: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
		} as unknown as Response;

		jsonRouteHandler({} as Request, response);

		expect(response.type).toHaveBeenCalledWith("application/json");
		expect(response.send).toHaveBeenCalledWith(document);
	});

	it("does not register JSON route when disableJsonPath is true", () => {
		const use = jest.fn();
		const app = {
			use,
		} as unknown as Pick<INestApplication, "use">;

		const document = {
			openapi: "3.1.0",
			paths: {},
		};

		mountScalarDocsWithJson(app, {
			docsPath: "/api/api-docs",
			jsonPath: "/api/api-docs/openapi.json",
			document: document as any,
			pageTitle: "Bullhouse Admin API",
			theme: "kepler",
			disableJsonPath: true,
		});

		expect(use).toHaveBeenCalledTimes(1);
		expect(use).toHaveBeenCalledWith("/api/api-docs", expect.any(Function));
	});
});

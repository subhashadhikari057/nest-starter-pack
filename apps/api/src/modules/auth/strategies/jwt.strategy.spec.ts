import type { ConfigService } from "@nestjs/config";

import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy", () => {
	it("extracts JWT from Authorization bearer header", () => {
		const configService = {
			get: jest.fn((key: string) => {
				if (key === "JWT_PUBLIC_KEY_BASE64") {
					return Buffer.from("test-public-key").toString("base64");
				}
				return undefined;
			}),
		} as unknown as ConfigService;

		const strategy = new JwtStrategy({} as never, configService);
		const extractor = (strategy as unknown as { _jwtFromRequest: Function })
			._jwtFromRequest;

		expect(
			extractor({ headers: { authorization: "Bearer header-token" } }),
		).toBe("header-token");
	});

	it("does not extract JWT from cookies anymore", () => {
		const configService = {
			get: jest.fn((key: string) => {
				if (key === "JWT_PUBLIC_KEY_BASE64") {
					return Buffer.from("test-public-key").toString("base64");
				}
				return undefined;
			}),
		} as unknown as ConfigService;

		const strategy = new JwtStrategy({} as never, configService);
		const extractor = (strategy as unknown as { _jwtFromRequest: Function })
			._jwtFromRequest;

		expect(
			extractor({ cookies: { access_token: "cookie-token" }, headers: {} }),
		).toBeNull();
	});
});

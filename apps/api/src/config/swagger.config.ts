import type { INestApplication } from "@nestjs/common";

import { configureDefaultSwagger } from "./swagger/default.swagger";
import { configureMobileSwagger } from "./swagger/mobile.swagger";

export type SwaggerBootMode = "eager" | "disabled";

export type SwaggerBootPolicy = {
	enabled: boolean;
	mode: SwaggerBootMode;
};

export const shouldConfigureSwagger = ({
	enabled,
	mode,
}: SwaggerBootPolicy): boolean => enabled && mode === "eager";

export function configureSwagger(app: INestApplication): void {
	configureDefaultSwagger(app);
	configureMobileSwagger(app);
}

import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsInt } from "class-validator";

export class AssignPermissionsDto {
	@ApiProperty({
		type: [Number],
		description: "An array of permission IDs to assign to the role.",
	})
	@IsArray()
	@IsInt({ each: true })
	permissionIds: number[];
}

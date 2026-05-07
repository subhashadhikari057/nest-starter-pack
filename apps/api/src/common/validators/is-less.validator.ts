import {
	registerDecorator,
	ValidateIf,
	ValidationArguments,
	ValidationOptions,
} from "class-validator";

export function IsLessThan(
	property: string,
	validationOptions?: ValidationOptions,
) {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			name: "isLessThan",
			target: object.constructor,
			propertyName: propertyName,
			constraints: [property],
			options: validationOptions,
			validator: {
				validate(value: any, args: ValidationArguments) {
					const [relatedPropertyName] = args.constraints;
					const relatedValue = (args.object as any)[relatedPropertyName];

					// Only validate if both values are present
					if (
						value === undefined ||
						value === null ||
						relatedValue === undefined ||
						relatedValue === null
					) {
						return true;
					}

					return (
						typeof value === "number" &&
						typeof relatedValue === "number" &&
						value < relatedValue
					);
				},
				defaultMessage(args: ValidationArguments) {
					const [relatedPropertyName] = args.constraints;
					return `${propertyName} must be less than ${relatedPropertyName}`;
				},
			},
		});
	};
}

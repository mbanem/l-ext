import { stringToFieldObject, handleTryCatch, isEmpty } from './helpers-server.js';

export type Field = {
	name: string;
	type: string;
	isArray: boolean;
	isOptional: boolean;
	isDataEntry: boolean;
	attrs?: string;
};

export type Model = {
	fields: Field[];
	attrs?: string[];
};

export type Models = Record<string, Model>;

export type FieldAttrs = { fields: Field[]; attrs: string[] };
export type ModelFields = Record<string, FieldAttrs>;

const UI = {
	ui: 'ui',
	namesOnly: 'namesOnly',
	nonUI: 'nonUI',
	all: 'all',
} as const;
type UIType = (typeof UI)[keyof typeof UI];

const primitiveTypes = new Set([
	'string',
	'number',
	'boolean',
	'Date',
	'float',
	'decimal',
	'json',
	'Role',
]);

const orderedNames = new Set<string>([
	'id',
	'authorId',
	'userId',
	'employeeId',
	'customerId',
	'ownerId',
	'firstName',
	'lastName',
	'middleName',
	'name',
	'completed',
	'profileId',
	'dob',
	'dateOfBirth',
	'email',
	'password',
	'bio',
	'biography',
	'address',
	'city',
	'state',
	'title',
	'content',
	'category',
	'role',
	'priority',
	'price',
	'updatedAt',
]);

const typeConversionMap: Record<string, string> = {
	String: 'string',
	Boolean: 'boolean',
	Int: 'number',
	Float: 'number',
	Decimal: 'string',
	BigInt: 'string',
	DateTime: 'Date',
	Json: 'any',
	Bytes: 'Uint8Array',
};

const prismaTypeRegex = new RegExp(
	`\\b(${Object.keys(typeConversionMap).join('|')})\\b`,
	'g',
);

function convertPrismaTypesToTS(line: string): string {
	return line.replace(
		prismaTypeRegex,
		(prismaType) => typeConversionMap[prismaType],
	);
}

/**
 * Checks whether a field is a UI/data-entry candidate.
 * Receives `models` explicitly so we avoid stale module-level state.
 */
function isUICandidate(field: Field, models: Models): boolean {
	const { name, type, isArray, attrs } = field;

	if (models[name] || models[type] || isArray) {
		return false;
	}
	if (
		name.includes('@@') ||
		(type === 'Date' && name === 'createdAt') ||
		/hash|token/i.test(name)
	) {
		return false;
	}

	return (
		/\b@id @default(uuid())\b/i.test(attrs ?? '') ||
		(type === 'Date' && name === 'updatedAt') ||
		primitiveTypes.has(type)
	);
}

/**
 * Sorts each model's fields so preferred `orderedNames` appear first,
 * followed by remaining UI candidates, and finally non-UI/relation fields.
 */
async function sortModelsByOrdered(models: Models, kind: UIType = UI.all): Promise<void> {
	if (isEmpty(models)) {
		throw new Error('models is an empty object');
	}

	for (const [modelName, model] of Object.entries(models)) {
		if (isEmpty(model.fields)) {
			throw new Error(`models[${modelName}] is an empty object`);
		}

		let orderedFields: Field[] = [];
		const leftoverFields: Field[] = [];
		const currentModelsAllFields = new Map(
			model.fields.map((f) => [f.name, f]),
		);

		if (kind === UI.ui || kind === UI.all) {
			for (const key of orderedNames) {
				const field = currentModelsAllFields.get(key);
				if (field) {
					orderedFields.push(field);
				}
			}

			for (const field of model.fields) {
				field.isDataEntry = isUICandidate(field, models);
				if (!orderedFields.includes(field) && field.isDataEntry) {
					orderedFields.push(field);
				}
			}
		}

		for (const field of model.fields) {
			if (!orderedFields.includes(field)) {
				leftoverFields.push(field);
			}
		}

		orderedFields = orderedFields.filter(Boolean);
		models[modelName].fields = [...orderedFields, ...leftoverFields];
	}
}

export async function parsePrismaSchema(
	schemaContent: string,
): Promise<{ models: Models; enums: TEnums }> {
	// Fresh objects per invocation prevent stale models when re-parsing updated schemas
	const models: Models = {};
	const enums = {} as TEnums;

	// Fresh regex instances ensure lastIndex always starts at 0
	const modelRegex = /\s*model\s+(\w+)\s*{([\s\S]*?)^\}/gm;
	const enumRegex = /\s*enum\s+(\w+)\s*{([\s\S]*?)^\}/gm;

	try {
		let modelMatch: RegExpExecArray | null;
		while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
			const [, modelName, body] = modelMatch;
			const fields: Field[] = [];
			const modelAttrs: string[] = [];

			const bodyWithoutBlocks = body.replace(/\/\*[\s\S]*?\*\//g, '');
			const lines = bodyWithoutBlocks
				.split('\n')
				.map((line) => line.trim().replace(/\s{2,}|\t/gm, ' '))
				.filter(Boolean);

			for (let line of lines) {
				if (line.startsWith('//')) {
					continue;
				}
				line = convertPrismaTypesToTS(line);

				if (line.startsWith('@@')) {
					modelAttrs.push(line);
				} else {
					const fld = stringToFieldObject(line) as Field;
					fld.isDataEntry = isUICandidate(fld, models);
					fields.push(fld);
				}
			}

			models[modelName] = {
				fields,
				attrs: modelAttrs,
			};
		}

		if (!isEmpty(models)) {
			await sortModelsByOrdered(models, UI.all);
		}

		let enumMatch: RegExpExecArray | null;
		while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
			const [, enumName, roles] = enumMatch;
			enums[enumName] = {} as TEnum;
			if (roles && enumName && enums[enumName]) {
				for (const role of roles.split(/\s+/).filter(Boolean)) {
					const rol = role.toUpperCase();
					enums[enumName][rol] = rol;
				}
			}
		}
	} catch (err: unknown) {
		handleTryCatch(err, 'parsePrismaSchema');
	}

	return { models, enums };
}
/*
NOTE: this is mapping Prisma -> TypeScript for variable types
| Prisma   | UI field       | TypeScript form value |
| -------- | -------------- | --------------------- |
| String   | text           | string                |
| Boolean  | checkbox       | boolean               |
| Int      | number         | number                |
| Float    | number         | number                |
| Decimal  | number         | string                |
| BigInt   | number         | string                |
| DateTime | datetime-local | string                |
| Json     | textarea       | string                |
| Bytes    | file           | File                  |

<input type="datetime-local">
browsers return value as string and server must convert new Date(value)

  prisma/schema.prisma is actually loaded by extension
*/
import {
  stringToFieldObject,
  handleTryCatch,
  isEmpty,
} from '../utils/helpers.js'

// export type Field = { name: string; type: string; attrs?: string }
// export type Field = {
//   name: string
//   type: string
//   isArray: boolean
//   isOptional: boolean
//   isDataEntry: boolean
//   attrs?: string
//   permissions?: string[]
// }
// no name; it should be part of Models with their name as a key
// export type Model = {
//   fields: Field[]
//   attrs?: string[]
// }
// export type Models = Record<string, Model>
// all models; modelName as a key
const models: Models = {}

// no name; it should be part of ModelFields that has model name as a key
export type FieldAttrs = { fields: Field[]; attrs: string[] }
export type ModelFields = Record<string, FieldAttrs>

// extact model name and field description as a body from schema.prisma
// const modelRegex = /model\s+(\w+)\s*{([^}]*)}/gms
const modelRegex = /\s*model\s+(\w+)\s*{([\s\S]*?)^\}/gm
const enumRegex = /\s*enum\s+(\w+)\s*{([\s\S]*?)^\}/gm

// arg enum for selecting ui/non UI fields or names from models object
const UI = {
  ui: 'ui',
  namesOnly: 'namesOnly',
  nonUI: 'nonUI',
  all: 'all',
} as const
type UIType = (typeof UI)[keyof typeof UI]

// when selecting UI fields tests is the field TS data type
const primitiveTypes = new Set([
  'string',
  'number',
  'boolean',
  'Date',
  'float',
  'decimal',
  'json',
  'Role',
])

// schema.prisma usually have fields in order that are not likeable
// like having Id filds in the middle of the list, so the orderedNames
// is forceing list to begin with orderedNames field names if any and
// then including the rest of schema.prisma fields
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
])

/**
 * Inside sortModelsByOrdered check if field is UI/data-entry field
 * @param field itself
 */
function isUICandidate(field: Field): boolean {
  const { name, type, isArray, attrs } = field
  // type = type.toLowerCase().trim();
  // model name could appear in schema as 'model User {' or as field type 'posts Post[]', so
  // the name and type arguments cannot bear model name, which is not ui candidates
  if (models[name] || models[type] || isArray) {
    return false
  }
  if (
    name.includes('@@') ||
    (type === 'Date' && name === 'createdAt') ||
    /hash|token/i.test(name)
  ) {
    return false
  }
  // additional fields are data entry fields @id updatedAt and all primitive types
  const ui =
    /\b@id @default(uuid())\b/i.test(attrs as string) ||
    (type === 'Date' && name === 'updatedAt') ||
    primitiveTypes.has(type)
  return ui
}

/**
 *  LEADING array part sorted by orderedNames followed by leftowers
 */
function sortModelsByOrdered(kind: UIType = UI.all) {
  if (isEmpty(models)) {
    throw new Error('models is an empty object')
  }
  let orderedFields: Field[] = []
  let leftoverFields: Field[] = []
  // models -- the only place where models are used
  for (const [modelName, model] of Object.entries(models)) {
    if (isEmpty(model.fields)) {
      throw new Error(`models[${modelName}] is an empty object`)
    }
    //  Map<string, Field> to access field object by fieldName
    const currentModelsAllFields = new Map(model.fields.map((f) => [f.name, f]))
    // what type of structure to create and return
    // load ui candidate fields if UI.ui required or as the first part for UI.all
    if (kind === UI.ui || kind === UI.all) {
      // select first the fields matching preordered preferred order
      for (const key of orderedNames) {
        // orderedNames array holds UI/data-entry field names to take fields
        // at top of the list at preferable position

        // if model's field name is in preordered list, include it in the orderedFields top part
        const field = currentModelsAllFields.get(key)
        if (field) {
          orderedFields.push(field)
        }
      }

      // now append all fields not included at the top preferred position
      for (const field of model.fields) {
        field.isDataEntry = isUICandidate(field)
        // for rest of fields not selected by orderedNames test if they are UI candidates
        if (!orderedFields.includes(field) && field.isDataEntry) {
          field.isDataEntry = true
          orderedFields.push(field)
        }
      }
      // UI.ui candidate fields are now selected
    }

    // but model could contain non-ui fields like createdAt, Todo[],...
    // so we selected then as leftover from ui candidate ones
    for (const field of model.fields) {
      if (!orderedFields.includes(field)) {
        leftoverFields.push(field)
      }
    }
    orderedFields = orderedFields.filter(Boolean)
    models[modelName].fields = [...orderedFields, ...leftoverFields]
    // loop level arrays starts loop as empty arrays
    orderedFields = []
    leftoverFields = []
    // uiNames = ''
  }
  // return [uiModels, nuiModels, exModels];
}

// conversion map Prisma data type --> TypeScript type
const typeConversionMap: Record<string, string> = {
  String: 'string',
  Boolean: 'boolean',
  Int: 'number',
  Float: 'number',
  Decimal: 'string',
  BigInt: 'string',
  DateTime: 'Date',
  Json: 'any',
  Bytes: 'Uint8Array', // more common than File in Node
}

// regex to select types that need conversion
const prismaTypeRegex = new RegExp(
  `\\b(${Object.keys(typeConversionMap).join('|')})\\b`,
  'g',
)

// return line with conversion into TypeScript type
function convertPrismaTypesToTS(line: string): string {
  return line.replace(
    prismaTypeRegex,
    (prismaType) => typeConversionMap[prismaType],
  )
}

// the main function to generate models sort fields to sync with ordered names and restur models
export function parsePrismaSchema(schemaContent: string): {
  models: Models
  enums: TEnums
} {
  // holds an array of field objects extracted from the model body
  // to be stuff in owning model
  let fields: Field[] = []
  let modelMatch

  try {
    // extract model name and body holding all field descriptions
    while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
      const [, modelName, body] = modelMatch // skip zero match item as it holds the whole search string

      const modelAttrs: string[] = []
      // Remove block comments /* ... */ first
      const bodyWithoutBlocks = body.replace(/\/\*[\s\S]*?\*\//g, '')

      // trim lines and reduce white spaces to a single one
      const lines = bodyWithoutBlocks
        .split('\n')
        .map((line) => line.trim().replace(/\s{2,}|\t/gm, ' '))
        .filter(Boolean)

      // lines are trimmed already
      for (let line of lines) {
        if (line.startsWith('//')) {
          continue
        }
        line = convertPrismaTypesToTS(line)

        // example model line: 'author    User     @relation(fields: [authorId], references: [id])'
        // first two split are OK, the rest should be recombined back
        // const parts = line.split(/\s+/); // split on whitespace
        // const attrs = parts.slice(2).join(' '); // following are attributes we want as a single string
        if (line.startsWith('@@')) {
          // database block attribute
          modelAttrs.push(line)
        } else {
          // cannot be done as push(`${stringToFieldObject(line)}`), so make a fld first
          const fld = stringToFieldObject(line) as Field
          fld.isDataEntry = isUICandidate(fld)
          fields.push(fld)
        }
      }
      models[modelName] = {
        fields,
        attrs: modelAttrs,
      }
      fields = []
    }
  } catch (err) {
    handleTryCatch(err)
  }
  sortModelsByOrdered(UI.all)

  let enumMatch
  const enums: TEnums = {}
  while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
    const [, enumName, roles] = enumMatch // skip zero match item as it holds the whole search string
    enums[enumName as string] = {}
    if (roles && enumName && enums[enumName]) {
      for (const role of roles.split(/\s+/)) {
        const rol = role.toUpperCase()
        enums[enumName][rol] = rol
      }
    }
  }
  console.log(
    '[ormOne] call parsePrismaSchema models.length',
    Object.keys(models).length,
  )
  return { models, enums }
}

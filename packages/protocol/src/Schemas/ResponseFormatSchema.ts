import { z } from "zod";

export const ResponseSchemaWrapperSchema = z.looseObject({ schema: z.record(z.string(), z.unknown()) });

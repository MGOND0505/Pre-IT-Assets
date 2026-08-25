import { Router } from "express";
import { validate } from "../../middleware/validate";
import * as searchController from "./search.controller";
import { searchQuerySchema } from "./search.validation";

export const searchRouter = Router();

// No requireModuleEnabled/authorize gate at the router level - this spans several
// entitlement-gated modules at once, so search.service.ts checks each one individually and
// simply omits any module the requesting user can't otherwise see.
searchRouter.get("/", validate({ query: searchQuerySchema }), searchController.search);

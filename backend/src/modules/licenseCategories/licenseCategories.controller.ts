import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as licenseCategoriesService from "./licenseCategories.service";

export const listLicenseCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await licenseCategoriesService.listLicenseCategories(req.query as never);
  ok(res, result, "License categories");
});

export const getLicenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await licenseCategoriesService.getLicenseCategoryById(req.params.id);
  ok(res, category, "License category");
});

export const createLicenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await licenseCategoriesService.createLicenseCategory(req.body);

  await logAction({
    req,
    action: "CREATE",
    module: "LicenseCategory",
    recordId: category.id,
    recordLabel: category.name,
    newValue: req.body,
  });

  ok(res, category, "License category created", 201);
});

export const updateLicenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const before = await licenseCategoriesService.getLicenseCategoryById(req.params.id);
  const oldValue = { name: before.name, description: before.description, status: before.status };

  const category = await licenseCategoriesService.updateLicenseCategory(req.params.id, req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "LicenseCategory",
    recordId: category.id,
    recordLabel: category.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, category, "License category updated");
});

export const deleteLicenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await licenseCategoriesService.deleteLicenseCategory(req.params.id);

  await logAction({
    req,
    action: "DELETE",
    module: "LicenseCategory",
    recordId: req.params.id,
    recordLabel: category.name,
  });

  ok(res, null, "License category deleted");
});

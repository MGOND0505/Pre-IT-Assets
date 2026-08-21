import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as departmentsService from "./departments.service";

export const listDepartments = asyncHandler(async (req: Request, res: Response) => {
  const result = await departmentsService.listDepartments(req.query as never);
  ok(res, result, "Departments");
});

export const getDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentsService.getDepartmentById(req.params.id);
  ok(res, department, "Department");
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentsService.createDepartment(req.body);

  await logAction({
    req,
    action: "CREATE",
    module: "Department",
    recordId: department.id,
    recordLabel: department.name,
    newValue: req.body,
  });

  ok(res, department, "Department created", 201);
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const before = await departmentsService.getDepartmentById(req.params.id);
  const oldValue = { name: before.name, description: before.description, status: before.status };

  const department = await departmentsService.updateDepartment(req.params.id, req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "Department",
    recordId: department.id,
    recordLabel: department.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, department, "Department updated");
});

export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await departmentsService.deleteDepartment(req.params.id);

  await logAction({
    req,
    action: "DELETE",
    module: "Department",
    recordId: req.params.id,
    recordLabel: department.name,
  });

  ok(res, null, "Department deleted");
});

import { Prisma } from "@prisma/client";
import { AppError } from "../../helpers/error";
import prisma from "../../lib/prisma";
import { CreateCategoryInput, UpdateCategoryInput } from "../../schemas/category.schema";

export const listActiveCategoriesService = async () => {
    try {
        return await prisma.category.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const createCategoryService = async (payload: CreateCategoryInput) => {
    try {
        const { name, description, isActive } = payload;

        const existing = await prisma.category.findUnique({ where: { name } });
        if (existing) {
            throw new AppError(409, 'CATEGORY_EXISTS', `A category named '${name}' already exists`);
        }

        return await prisma.category.create({
            data: { name, description: description ?? null, isActive },
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const updateCategoryService = async (id: string, payload: UpdateCategoryInput) => {
    try {
        const existing = await prisma.category.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'NOT_FOUND', `Category with id '${id}' not found`);
        }

        if (payload.name && payload.name !== existing.name) {
            const nameTaken = await prisma.category.findUnique({ where: { name: payload.name } });
            if (nameTaken) {
                throw new AppError(409, 'CATEGORY_EXISTS', `A category named '${payload.name}' already exists`);
            }
        }

        const data: Prisma.CategoryUpdateInput = {};
        if (payload.name !== undefined) {
            data.name = payload.name;
        }
        if (payload.isActive !== undefined) {
            data.isActive = payload.isActive;
        }
        if ('description' in payload) {
            data.description = payload.description ?? null;
        }

        return await prisma.category.update({ where: { id }, data });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

export const deleteCategoryService = async (id: string): Promise<void> => {
    try {
        const existing = await prisma.category.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'NOT_FOUND', `Category with id '${id}' not found`);
        }

        await prisma.category.delete({ where: { id } });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', error.message);
    }
}

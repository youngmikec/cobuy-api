import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../helpers/error";
import {
    createCategoryService,
    deleteCategoryService,
    listActiveCategoriesService,
    updateCategoryService,
} from "../services/route-services/category-service";
import { CategoryIdParams, CreateCategoryInput, UpdateCategoryInput } from "../schemas/category.schema";

export const listActiveCategoriesHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
        const categories = await listActiveCategoriesService();

        return reply.status(200).send({
            success: true,
            data: categories,
            message: "Categories retrieved successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const createCategoryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const category = await createCategoryService(request.body as CreateCategoryInput);

        return reply.status(201).send({
            success: true,
            data: category,
            message: "Category created successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const updateCategoryHandler = async (
    request: FastifyRequest<{ Params: CategoryIdParams }>,
    reply: FastifyReply,
) => {
    try {
        const category = await updateCategoryService(request.params.id, request.body as UpdateCategoryInput);

        return reply.status(200).send({
            success: true,
            data: category,
            message: "Category updated successfully",
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

export const deleteCategoryHandler = async (
    request: FastifyRequest<{ Params: CategoryIdParams }>,
    reply: FastifyReply,
) => {
    try {
        await deleteCategoryService(request.params.id);

        return reply.status(204).send();
    } catch (error: any) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(500, 'SERVER_ERROR', `${error.message}`);
    }
}

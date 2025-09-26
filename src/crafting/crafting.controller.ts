import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CraftingService, CreateCraftingRecipeDto, CraftItemDto } from './crafting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CraftingRecipe } from './crafting-recipe.entity';

@Controller('crafting')
@UseGuards(JwtAuthGuard)
export class CraftingController {
  constructor(private readonly craftingService: CraftingService) {}

  // Player endpoints
  @Get('recipes')
  async getAvailableRecipes(@Request() req: any): Promise<CraftingRecipe[]> {
    return this.craftingService.getAvailableRecipes(req.user.id);
  }

  @Get('recipes/category/:category')
  async getRecipesByCategory(@Param('category') category: string): Promise<CraftingRecipe[]> {
    return this.craftingService.getRecipesByCategory(parseInt(category));
  }

  @Post('craft')
  async craftItem(@Request() req: any, @Body() dto: CraftItemDto) {
    return this.craftingService.craftItem(req.user.id, dto);
  }

  // Admin endpoints
  @Get('admin/recipes')
  async getAllRecipes(): Promise<CraftingRecipe[]> {
    return this.craftingService.getAllRecipes();
  }

  @Get('admin/recipes/:id')
  async getRecipeById(@Param('id') id: string): Promise<CraftingRecipe> {
    return this.craftingService.getRecipeById(parseInt(id));
  }

  @Post('admin/recipes')
  async createRecipe(@Body() dto: CreateCraftingRecipeDto): Promise<CraftingRecipe> {
    return this.craftingService.createRecipe(dto);
  }

  @Put('admin/recipes/:id')
  async updateRecipe(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCraftingRecipeDto>,
  ): Promise<CraftingRecipe> {
    return this.craftingService.updateRecipe(parseInt(id), dto);
  }

  @Delete('admin/recipes/:id')
  async deleteRecipe(@Param('id') id: string): Promise<{ message: string }> {
    await this.craftingService.deleteRecipe(parseInt(id));
    return { message: 'Recipe deleted successfully' };
  }
}

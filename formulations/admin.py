from django.contrib import admin

from .models import Batch, BatchIngredient, BatchNote, Ingredient, Recipe, RecipeIngredient

admin.site.register(Ingredient)
admin.site.register(Recipe)
admin.site.register(RecipeIngredient)
admin.site.register(Batch)
admin.site.register(BatchIngredient)
admin.site.register(BatchNote)

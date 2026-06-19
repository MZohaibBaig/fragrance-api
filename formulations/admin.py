from django.contrib import admin
from .models import Ingredient, Formula, FormulaIngredient

admin.site.register(Ingredient)
admin.site.register(Formula)
admin.site.register(FormulaIngredient)
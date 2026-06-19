from django.db import models
from django.contrib.auth.models import User


class Ingredient(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ingredients')
    name = models.CharField(max_length=255)
    article_number = models.CharField(max_length=100, blank=True, null=True)
    supplier = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.supplier})"

class Formula(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='formulas')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    target_fragrance = models.CharField(max_length=255, blank=True, null=True)
    batch_size_ml = models.DecimalField(max_digits=8, decimal_places=2, default=100.00)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} by {self.user.username}"

class FormulaIngredient(models.Model):
    formula = models.ForeignKey(Formula, on_delete=models.CASCADE, related_name='formula_ingredients')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='formula_ingredients')
    percentage = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        unique_together = ('formula', 'ingredient')

    def __str__(self):
        return f"{self.ingredient.name} in {self.formula.name} at {self.percentage}%"
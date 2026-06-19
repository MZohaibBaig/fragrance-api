from rest_framework import serializers
from .models import Ingredient, Formula, FormulaIngredient


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ['id', 'name', 'article_number', 'supplier', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class FormulaIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    quantity_in_grams = serializers.SerializerMethodField()

    class Meta:
        model = FormulaIngredient
        fields = ['id', 'ingredient', 'ingredient_name', 'percentage', 'quantity_in_grams']

    def get_quantity_in_grams(self, obj):
        return round((obj.percentage / 100) * obj.formula.batch_size_ml, 2)


class FormulaSerializer(serializers.ModelSerializer):
    formula_ingredients = FormulaIngredientSerializer(many=True, read_only=True)

    class Meta:
        model = Formula
        fields = ['id', 'name', 'description', 'target_fragrance', 'batch_size_ml', 'created_at', 'formula_ingredients']
        read_only_fields = ['id', 'created_at']
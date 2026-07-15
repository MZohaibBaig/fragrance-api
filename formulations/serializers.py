from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import Batch, BatchIngredient, BatchNote, Ingredient, Recipe, RecipeIngredient

DISPLAY_PRECISION = Decimal('0.01')


def round_display(value: Decimal) -> Decimal:
    return value.quantize(DISPLAY_PRECISION)


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = [
            'id',
            'name',
            'article_number',
            'supplier',
            'description',
            'dilution_strength',
            'density_g_per_ml',
            'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class RecipeIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ['id', 'recipe', 'ingredient', 'ingredient_name', 'proportion']

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request is not None and request.user.is_authenticated:
            self.fields['recipe'].queryset = Recipe.objects.filter(owner=request.user)
            self.fields['ingredient'].queryset = Ingredient.objects.filter(owner=request.user)


class RecipeSerializer(serializers.ModelSerializer):
    owner = serializers.HiddenField(default=serializers.CurrentUserDefault())
    recipe_ingredients = RecipeIngredientSerializer(many=True, read_only=True)
    proportions_total = serializers.SerializerMethodField()
    is_balanced = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'id',
            'owner',
            'name',
            'description',
            'default_concentration',
            'diluent_name',
            'default_maceration_days',
            'created_at',
            'updated_at',
            'recipe_ingredients',
            'proportions_total',
            'is_balanced',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_proportions_total(self, obj: Recipe) -> str:
        total = sum((ri.proportion for ri in obj.recipe_ingredients.all()), Decimal('0'))
        return str(round_display(total))

    def get_is_balanced(self, obj: Recipe) -> bool:
        total = sum((ri.proportion for ri in obj.recipe_ingredients.all()), Decimal('0'))
        return total == Decimal('100')


class BatchIngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchIngredient
        fields = ['id', 'ingredient', 'ingredient_name', 'proportion', 'grams']
        read_only_fields = fields

    def to_representation(self, instance: BatchIngredient) -> dict:
        data = super().to_representation(instance)
        data['grams'] = str(round_display(instance.grams))
        return data


class BatchNoteSerializer(serializers.ModelSerializer):
    day_number = serializers.SerializerMethodField()

    class Meta:
        model = BatchNote
        fields = ['id', 'batch', 'observed_on', 'body', 'day_number', 'created_at']
        read_only_fields = ['id', 'created_at']

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request is not None and request.user.is_authenticated:
            self.fields['batch'].queryset = Batch.objects.filter(owner=request.user)

    def get_day_number(self, obj: BatchNote) -> int:
        return (obj.observed_on - obj.batch.made_on).days


class BatchSerializer(serializers.ModelSerializer):
    ingredients = BatchIngredientSerializer(many=True, read_only=True)
    notes = BatchNoteSerializer(many=True, read_only=True)
    aromatic_g = serializers.SerializerMethodField()
    diluent_g = serializers.SerializerMethodField()
    days_macerating = serializers.SerializerMethodField()
    ready_on = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    maceration_progress = serializers.SerializerMethodField()
    is_due = serializers.SerializerMethodField()
    concentration = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=0, max_value=100, required=False
    )
    maceration_days = serializers.IntegerField(required=False, min_value=1)

    class Meta:
        model = Batch
        fields = [
            'id',
            'recipe',
            'batch_size_g',
            'concentration',
            'maceration_days',
            'made_on',
            'status',
            'rating',
            'created_at',
            'aromatic_g',
            'diluent_g',
            'recipe_was_balanced',
            'days_macerating',
            'ready_on',
            'days_remaining',
            'maceration_progress',
            'is_due',
            'ingredients',
            'notes',
        ]
        read_only_fields = ['id', 'created_at', 'recipe_was_balanced']

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request is not None and request.user.is_authenticated:
            self.fields['recipe'].queryset = Recipe.objects.filter(owner=request.user)

    def get_aromatic_g(self, obj: Batch) -> str:
        return str(round_display(obj.aromatic_g))

    def get_diluent_g(self, obj: Batch) -> str:
        return str(round_display(obj.diluent_g))

    def get_days_macerating(self, obj: Batch) -> int:
        return (timezone.localdate() - obj.made_on).days

    def get_ready_on(self, obj: Batch) -> date:
        return obj.made_on + timedelta(days=obj.maceration_days)

    def get_days_remaining(self, obj: Batch) -> int:
        return (self.get_ready_on(obj) - timezone.localdate()).days

    def get_maceration_progress(self, obj: Batch) -> str:
        progress = (Decimal(self.get_days_macerating(obj)) / obj.maceration_days) * 100
        clamped = max(Decimal('0'), min(Decimal('100'), progress))
        return str(clamped.quantize(DISPLAY_PRECISION))

    def get_is_due(self, obj: Batch) -> bool:
        return self.get_days_macerating(obj) >= obj.maceration_days and obj.status == Batch.STATUS_MACERATING

    def create(self, validated_data: dict) -> Batch:
        recipe = validated_data['recipe']
        validated_data.setdefault('concentration', recipe.default_concentration)
        validated_data.setdefault('maceration_days', recipe.default_maceration_days)
        batch = Batch.objects.create(**validated_data)
        batch.compute()
        return batch

    def update(self, instance: Batch, validated_data: dict) -> Batch:
        recompute_fields = {'batch_size_g', 'concentration', 'recipe'}
        needs_recompute = any(field in validated_data for field in recompute_fields)
        instance = super().update(instance, validated_data)
        if needs_recompute:
            instance.compute()
        return instance

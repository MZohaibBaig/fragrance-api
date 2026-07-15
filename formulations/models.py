import logging
from decimal import ROUND_HALF_UP, Decimal

from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction

logger = logging.getLogger(__name__)

GRAM_PRECISION = Decimal('0.000001')


class Ingredient(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ingredients')
    name = models.CharField(max_length=255)
    article_number = models.CharField(max_length=100, blank=True, null=True)
    supplier = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    dilution_strength = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100,
        validators=[MinValueValidator(Decimal('0.01')), MaxValueValidator(100)],
    )
    # % strength of this material as stocked (100 = neat). Not used in v1 math -
    # reserved so a diluted material (e.g. Iso E Super at 10% in DPG) can be
    # factored into batch math later without a schema change.
    density_g_per_ml = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    # Display-only. Never used in core math.
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'{self.name} ({self.supplier})'


class Recipe(models.Model):
    """
    Weight-native (w/w). default_concentration is the percent of the finished
    perfume, by weight, that is aromatic material - not a per-ingredient share.
    The diluent (ethanol, DPG, IPM, ...) is never an ingredient row; it is
    always the remainder of a batch: batch weight minus aromatic weight.
    """

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recipes')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    default_concentration = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    diluent_name = models.CharField(max_length=100, default='Ethanol')
    default_maceration_days = models.PositiveSmallIntegerField(
        default=28,
        validators=[MinValueValidator(1)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['owner', 'name'], name='unique_recipe_name_per_owner'),
        ]

    def __str__(self) -> str:
        return f'{self.name} ({self.owner.username})'


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='recipe_ingredients')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name='recipe_ingredients')
    proportion = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    # This ingredient's share of the aromatic phase, w/w. Proportions across a
    # recipe should sum to 100, but that isn't enforced at save time - a
    # half-built recipe must still be saveable. See RecipeSerializer.is_balanced.

    class Meta:
        unique_together = ('recipe', 'ingredient')

    def __str__(self) -> str:
        return f'{self.ingredient.name} in {self.recipe.name} at {self.proportion}%'


class Batch(models.Model):
    STATUS_MACERATING = 'macerating'
    STATUS_READY = 'ready'
    STATUS_ARCHIVED = 'archived'
    STATUS_CHOICES = [
        (STATUS_MACERATING, 'Macerating'),
        (STATUS_READY, 'Ready'),
        (STATUS_ARCHIVED, 'Archived'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='batches')
    recipe = models.ForeignKey(Recipe, on_delete=models.PROTECT, related_name='batches')
    batch_size_g = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    concentration = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    # Snapshot of recipe.default_concentration at creation time; overridable per batch.
    maceration_days = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    # Snapshot of recipe.default_maceration_days at creation time; overridable per batch.
    made_on = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_MACERATING)
    rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Derived and frozen by compute() below. Never accept these from a client.
    aromatic_g = models.DecimalField(max_digits=14, decimal_places=6, editable=False, default=Decimal('0'))
    diluent_g = models.DecimalField(max_digits=14, decimal_places=6, editable=False, default=Decimal('0'))
    recipe_was_balanced = models.BooleanField(editable=False, default=False)

    def __str__(self) -> str:
        return f'{self.recipe.name} batch, {self.batch_size_g}g ({self.made_on})'

    def compute(self) -> None:
        """
        Freeze aromatic_g, diluent_g, recipe_was_balanced, and the per-ingredient
        BatchIngredient breakdown from the recipe's *current* RecipeIngredient rows.
        The server is the sole source of truth for these numbers.

        diluent_g is always the remainder (batch_size_g - aromatic_g), never
        computed independently, so the two sum to batch_size_g exactly - no
        Decimal drift. Must be called after self.pk exists (a prior .save()).
        """
        self.aromatic_g = (self.batch_size_g * self.concentration / Decimal('100')).quantize(
            GRAM_PRECISION, rounding=ROUND_HALF_UP
        )
        self.diluent_g = self.batch_size_g - self.aromatic_g

        recipe_ingredients = list(self.recipe.recipe_ingredients.select_related('ingredient').order_by('id'))
        proportions_total = sum((ri.proportion for ri in recipe_ingredients), Decimal('0'))
        self.recipe_was_balanced = proportions_total == Decimal('100')

        with transaction.atomic():
            self.save(update_fields=['aromatic_g', 'diluent_g', 'recipe_was_balanced'])
            self.ingredients.all().delete()
            self._create_ingredient_breakdown(recipe_ingredients)

        logger.info(
            'Computed batch %s (recipe=%s, batch_size_g=%s): aromatic_g=%s diluent_g=%s balanced=%s',
            self.pk,
            self.recipe_id,
            self.batch_size_g,
            self.aromatic_g,
            self.diluent_g,
            self.recipe_was_balanced,
        )
        if not self.recipe_was_balanced:
            logger.warning(
                'Batch %s computed from an unbalanced recipe (recipe=%s, proportions != 100)',
                self.pk,
                self.recipe_id,
            )

    def _create_ingredient_breakdown(self, recipe_ingredients: list['RecipeIngredient']) -> None:
        rows = []
        allocated = Decimal('0')
        last_index = len(recipe_ingredients) - 1
        for index, ri in enumerate(recipe_ingredients):
            if self.recipe_was_balanced and index == last_index:
                # Last row absorbs any rounding remainder so the breakdown sums
                # to aromatic_g exactly - only safe to do when the recipe's
                # proportions actually sum to 100.
                grams = self.aromatic_g - allocated
            else:
                grams = (self.aromatic_g * ri.proportion / Decimal('100')).quantize(
                    GRAM_PRECISION, rounding=ROUND_HALF_UP
                )
                allocated += grams
            rows.append(
                BatchIngredient(
                    batch=self,
                    ingredient=ri.ingredient,
                    ingredient_name=ri.ingredient.name,
                    proportion=ri.proportion,
                    grams=grams,
                )
            )
        BatchIngredient.objects.bulk_create(rows)


class BatchIngredient(models.Model):
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='ingredients')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name='batch_ingredients')
    ingredient_name = models.CharField(max_length=255)  # snapshot: survives later renames of the Ingredient
    proportion = models.DecimalField(max_digits=5, decimal_places=2)  # snapshot of RecipeIngredient.proportion
    grams = models.DecimalField(max_digits=14, decimal_places=6, editable=False)

    def __str__(self) -> str:
        return f'{self.ingredient_name}: {self.grams}g in batch #{self.batch_id}'


class BatchNote(models.Model):
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='notes')
    observed_on = models.DateField()
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f'Note on batch #{self.batch_id} ({self.observed_on})'

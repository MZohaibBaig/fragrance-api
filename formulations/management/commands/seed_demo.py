from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from formulations.models import Ingredient, Recipe, RecipeIngredient

INGREDIENTS = [
    {
        'name': 'Bergamot',
        'supplier': 'Firmenich',
        'notes': 'Bright citrus-green top note; photosensitizing, prefer bergapten-free.',
    },
    {
        'name': 'Lemon',
        'supplier': 'IFF',
        'notes': 'Sharp zesty citrus top note; fades fast, needs fixation support.',
    },
    {
        'name': 'Lavender',
        'supplier': 'Robertet',
        'notes': 'Herbaceous floral with a camphoraceous edge; classic fougere material.',
    },
    {
        'name': 'Hedione',
        'supplier': 'Firmenich',
        'notes': 'Diffusive, transparent jasmine-like floral; adds radiance and lift.',
    },
    {
        'name': 'Iso E Super',
        'supplier': 'IFF',
        'notes': 'Velvety woody-amber; nearly invisible alone but boosts everything around it.',
    },
    {
        'name': 'Ambroxan',
        'supplier': 'Givaudan',
        'notes': 'Dry ambergris-like woody-amber; long-lasting skin-scent base note.',
    },
    {
        'name': 'Vetiver',
        'supplier': 'Robertet',
        'notes': 'Smoky, earthy root note; grounding base for woody compositions.',
    },
    {
        'name': 'Patchouli',
        'supplier': 'Symrise',
        'notes': 'Dark, earthy-sweet base note; anchors oriental and woody accords.',
    },
    {
        'name': 'Cedarwood',
        'supplier': 'Firmenich',
        'notes': 'Dry, pencil-shaving woody note; softens and rounds out sharper top notes.',
    },
    {
        'name': 'Calone',
        'supplier': 'Symrise',
        'notes': 'Aquatic, melon-like marine note; dominates a blend, use sparingly.',
    },
    {
        'name': 'Galaxolide',
        'supplier': 'IFF',
        'notes': 'Clean musky base note; adds softness and laundry-fresh sillage.',
    },
    {
        'name': 'Ambrette',
        'supplier': 'Robertet',
        'notes': 'Soft, musky-floral seed note; natural alternative to synthetic musks.',
    },
]

RECIPES = [
    {
        'name': 'Citrus Bloom Cologne',
        'description': 'A bright, restrained citrus cologne built for warm weather.',
        'default_concentration': Decimal('8'),
        'diluent_name': 'Ethanol',
        'ingredients': [
            ('Bergamot', Decimal('40')),
            ('Lemon', Decimal('30')),
            ('Hedione', Decimal('20')),
            ('Galaxolide', Decimal('10')),
        ],
    },
    {
        'name': 'Cedar & Vetiver EDP',
        'description': 'A dry, woody eau de parfum anchored by vetiver and cedarwood.',
        'default_concentration': Decimal('18'),
        'diluent_name': 'Ethanol',
        'ingredients': [
            ('Cedarwood', Decimal('30')),
            ('Vetiver', Decimal('25')),
            ('Iso E Super', Decimal('25')),
            ('Ambroxan', Decimal('20')),
        ],
    },
    {
        'name': 'Amber Patchouli Extrait',
        'description': 'A dense, skin-warm amber extrait built around patchouli and ambrette.',
        'default_concentration': Decimal('25'),
        'diluent_name': 'Ethanol',
        'ingredients': [
            ('Patchouli', Decimal('35')),
            ('Ambroxan', Decimal('25')),
            ('Ambrette', Decimal('25')),
            ('Lavender', Decimal('15')),
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed demo ingredients and recipes for a given user. Idempotent - safe to re-run.'

    def add_arguments(self, parser):
        parser.add_argument('--user', required=True, help='Username to own the seeded data')

    def handle(self, *args, **options):
        username = options['user']
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as exc:
            raise CommandError(f"No user named '{username}'. Create it first (e.g. via /api/register/).") from exc

        ingredients_by_name = {}
        for spec in INGREDIENTS:
            ingredient, created = Ingredient.objects.get_or_create(
                owner=user,
                name=spec['name'],
                defaults={'supplier': spec['supplier'], 'notes': spec['notes']},
            )
            ingredients_by_name[spec['name']] = ingredient
            self.stdout.write(f'{"created" if created else "exists"}: ingredient {ingredient.name}')

        for spec in RECIPES:
            recipe, created = Recipe.objects.get_or_create(
                owner=user,
                name=spec['name'],
                defaults={
                    'description': spec['description'],
                    'default_concentration': spec['default_concentration'],
                    'diluent_name': spec['diluent_name'],
                },
            )
            self.stdout.write(f'{"created" if created else "exists"}: recipe {recipe.name}')

            for ingredient_name, proportion in spec['ingredients']:
                ingredient = ingredients_by_name[ingredient_name]
                _, ri_created = RecipeIngredient.objects.get_or_create(
                    recipe=recipe,
                    ingredient=ingredient,
                    defaults={'proportion': proportion},
                )
                if ri_created:
                    self.stdout.write(f'  added {ingredient_name} at {proportion}%')

        self.stdout.write(self.style.SUCCESS(f"Seed complete for user '{username}'."))

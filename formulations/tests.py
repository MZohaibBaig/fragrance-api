from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Formula, FormulaIngredient, Ingredient
from .serializers import FormulaIngredientSerializer


class AuthenticationTests(APITestCase):
    def test_unauthenticated_request_is_rejected(self) -> None:
        response = self.client.get('/api/ingredients/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class IngredientOwnershipTests(APITestCase):
    def setUp(self) -> None:
        self.user_a = User.objects.create_user(username='user_a', password='password123')
        self.user_b = User.objects.create_user(username='user_b', password='password123')

    def test_authenticated_user_can_create_own_ingredient(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/ingredients/', {'name': 'Bergamot'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Ingredient.objects.get(id=response.data['id']).user, self.user_a)

    def test_user_cannot_read_another_users_ingredient(self) -> None:
        ingredient = Ingredient.objects.create(user=self.user_a, name='Bergamot')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(f'/api/ingredients/{ingredient.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_modify_another_users_ingredient(self) -> None:
        ingredient = Ingredient.objects.create(user=self.user_a, name='Bergamot')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.patch(f'/api/ingredients/{ingredient.id}/', {'name': 'Hijacked'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        ingredient.refresh_from_db()
        self.assertEqual(ingredient.name, 'Bergamot')


class QuantityInGramsTests(APITestCase):
    def test_quantity_in_grams_is_computed_correctly(self) -> None:
        user = User.objects.create_user(username='formulator', password='password123')
        formula = Formula.objects.create(user=user, name='Test Formula', batch_size_ml=Decimal('200.00'))
        ingredient = Ingredient.objects.create(user=user, name='Bergamot')
        formula_ingredient = FormulaIngredient.objects.create(
            formula=formula, ingredient=ingredient, percentage=Decimal('12.50')
        )

        data = FormulaIngredientSerializer(formula_ingredient).data
        self.assertEqual(data['quantity_in_grams'], 25.0)

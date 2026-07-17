import os
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from . import views as ai_views
from .models import Batch, BatchIngredient, BatchNote, Ingredient, Recipe, RecipeIngredient


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
        self.assertEqual(Ingredient.objects.get(id=response.data['id']).owner, self.user_a)

    def test_user_cannot_read_another_users_ingredient(self) -> None:
        ingredient = Ingredient.objects.create(owner=self.user_a, name='Bergamot')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(f'/api/ingredients/{ingredient.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_modify_another_users_ingredient(self) -> None:
        ingredient = Ingredient.objects.create(owner=self.user_a, name='Bergamot')

        self.client.force_authenticate(user=self.user_b)
        response = self.client.patch(f'/api/ingredients/{ingredient.id}/', {'name': 'Hijacked'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        ingredient.refresh_from_db()
        self.assertEqual(ingredient.name, 'Bergamot')


class RecipeOwnershipTests(APITestCase):
    def setUp(self) -> None:
        self.user_a = User.objects.create_user(username='user_a', password='password123')
        self.user_b = User.objects.create_user(username='user_b', password='password123')
        self.recipe = Recipe.objects.create(
            owner=self.user_a,
            name='Citrus Bloom',
            default_concentration=Decimal('20'),
        )

    def test_user_cannot_read_another_users_recipe(self) -> None:
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(f'/api/recipes/{self.recipe.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_modify_another_users_recipe(self) -> None:
        self.client.force_authenticate(user=self.user_b)
        response = self.client.patch(f'/api/recipes/{self.recipe.id}/', {'name': 'Hijacked'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_attach_recipe_ingredient_to_another_users_recipe(self) -> None:
        ingredient = Ingredient.objects.create(owner=self.user_b, name='Bergamot')
        self.client.force_authenticate(user=self.user_b)
        response = self.client.post(
            '/api/recipe-ingredients/',
            {
                'recipe': self.recipe.id,  # belongs to user_a
                'ingredient': ingredient.id,
                'proportion': '100.00',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class BatchOwnershipTests(APITestCase):
    def setUp(self) -> None:
        self.user_a = User.objects.create_user(username='user_a', password='password123')
        self.user_b = User.objects.create_user(username='user_b', password='password123')
        self.recipe = Recipe.objects.create(
            owner=self.user_a,
            name='Citrus Bloom',
            default_concentration=Decimal('20'),
        )
        self.batch = Batch.objects.create(
            owner=self.user_a,
            recipe=self.recipe,
            batch_size_g=Decimal('40'),
            concentration=Decimal('20'),
            maceration_days=28,
            made_on=timezone.localdate(),
        )
        self.batch.compute()

    def test_user_cannot_read_another_users_batch(self) -> None:
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(f'/api/batches/{self.batch.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_create_batch_against_another_users_recipe(self) -> None:
        self.client.force_authenticate(user=self.user_b)
        response = self.client.post(
            '/api/batches/',
            {
                'recipe': self.recipe.id,  # belongs to user_a
                'batch_size_g': '40',
                'made_on': str(timezone.localdate()),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class GramMathTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username='formulator', password='password123')
        self.oil_a = Ingredient.objects.create(owner=self.user, name='Bergamot')
        self.oil_b = Ingredient.objects.create(owner=self.user, name='Sandalwood')

    def _make_batch(self, recipe: Recipe, batch_size_g: Decimal, concentration: Decimal) -> Batch:
        batch = Batch.objects.create(
            owner=self.user,
            recipe=recipe,
            batch_size_g=batch_size_g,
            concentration=concentration,
            maceration_days=28,
            made_on=timezone.localdate(),
        )
        batch.compute()
        return batch

    def test_single_ingredient_worked_example(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Single Oil', default_concentration=Decimal('22'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_a, proportion=Decimal('100'))

        batch = self._make_batch(recipe, Decimal('40'), Decimal('22'))

        self.assertEqual(batch.aromatic_g, Decimal('8.800000'))
        self.assertEqual(batch.diluent_g, Decimal('31.200000'))
        self.assertTrue(batch.recipe_was_balanced)
        rows = list(batch.ingredients.all())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].grams, Decimal('8.800000'))

    def test_multi_ingredient_worked_example(self) -> None:
        # 40g batch, 22% concentration, two oils at 60/40 ->
        # aromatic 8.8g (oil A 5.28g, oil B 3.52g) -> diluent 31.2g. Total 40g.
        recipe = Recipe.objects.create(owner=self.user, name='Two Oils', default_concentration=Decimal('22'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_a, proportion=Decimal('60'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_b, proportion=Decimal('40'))

        batch = self._make_batch(recipe, Decimal('40'), Decimal('22'))

        self.assertEqual(batch.aromatic_g, Decimal('8.800000'))
        self.assertEqual(batch.diluent_g, Decimal('31.200000'))
        rows = {row.ingredient_name: row.grams for row in batch.ingredients.all()}
        self.assertEqual(rows['Bergamot'], Decimal('5.280000'))
        self.assertEqual(rows['Sandalwood'], Decimal('3.520000'))

    def test_four_gram_tester_batch(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Tester', default_concentration=Decimal('25'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_a, proportion=Decimal('100'))

        batch = self._make_batch(recipe, Decimal('4'), Decimal('25'))

        self.assertEqual(batch.aromatic_g, Decimal('1.000000'))
        self.assertEqual(batch.diluent_g, Decimal('3.000000'))
        self.assertEqual(batch.aromatic_g + batch.diluent_g, batch.batch_size_g)

    def test_twenty_thousand_gram_production_batch(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Production Run', default_concentration=Decimal('15'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_a, proportion=Decimal('100'))

        batch = self._make_batch(recipe, Decimal('20000'), Decimal('15'))

        self.assertEqual(batch.aromatic_g, Decimal('3000.000000'))
        self.assertEqual(batch.diluent_g, Decimal('17000.000000'))
        self.assertEqual(batch.aromatic_g + batch.diluent_g, batch.batch_size_g)

    def test_aromatic_plus_diluent_always_equals_batch_size_no_drift(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Odd Split', default_concentration=Decimal('37'))
        oil_c = Ingredient.objects.create(owner=self.user, name='Iso E Super')
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_a, proportion=Decimal('33.33'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_b, proportion=Decimal('33.33'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=oil_c, proportion=Decimal('33.34'))

        for batch_size in (Decimal('4'), Decimal('7.13'), Decimal('19999.99'), Decimal('20000')):
            batch = self._make_batch(recipe, batch_size, Decimal('37'))
            self.assertEqual(batch.aromatic_g + batch.diluent_g, batch.batch_size_g)
            breakdown_total = sum((row.grams for row in batch.ingredients.all()), Decimal('0'))
            self.assertEqual(breakdown_total, batch.aromatic_g)

    def test_compute_is_atomic_on_mid_failure(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Atomic Check', default_concentration=Decimal('20'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_a, proportion=Decimal('100'))

        batch = Batch.objects.create(
            owner=self.user,
            recipe=recipe,
            batch_size_g=Decimal('40'),
            concentration=Decimal('20'),
            maceration_days=28,
            made_on=timezone.localdate(),
        )
        batch.compute()
        original_aromatic_g = batch.aromatic_g
        original_diluent_g = batch.diluent_g

        recipe.default_concentration = Decimal('90')
        recipe.save()
        batch.concentration = Decimal('90')

        with patch.object(BatchIngredient.objects, 'bulk_create', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                batch.compute()

        batch.refresh_from_db()
        self.assertEqual(batch.aromatic_g, original_aromatic_g)
        self.assertEqual(batch.diluent_g, original_diluent_g)
        self.assertEqual(batch.ingredients.count(), 1)
        self.assertEqual(batch.ingredients.get().grams, original_aromatic_g)

    def test_batch_survives_later_recipe_edits(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Evolving', default_concentration=Decimal('20'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_a, proportion=Decimal('100'))

        batch = self._make_batch(recipe, Decimal('50'), Decimal('20'))
        original_aromatic = batch.aromatic_g
        original_grams = batch.ingredients.get().grams

        recipe.default_concentration = Decimal('80')
        recipe.save()
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.oil_b, proportion=Decimal('50'))
        RecipeIngredient.objects.filter(ingredient=self.oil_a).update(proportion=Decimal('50'))

        batch.refresh_from_db()
        self.assertEqual(batch.aromatic_g, original_aromatic)
        self.assertEqual(batch.ingredients.get(ingredient=self.oil_a).grams, original_grams)
        self.assertEqual(batch.ingredients.count(), 1)


class RecipeBalanceTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username='formulator', password='password123')
        self.client.force_authenticate(user=self.user)
        self.ingredient = Ingredient.objects.create(owner=self.user, name='Bergamot')
        self.recipe = Recipe.objects.create(
            owner=self.user,
            name='Half Built',
            default_concentration=Decimal('20'),
        )

    def test_saving_an_unbalanced_recipe_is_not_blocked(self) -> None:
        response = self.client.post(
            '/api/recipe-ingredients/',
            {
                'recipe': self.recipe.id,
                'ingredient': self.ingredient.id,
                'proportion': '60.00',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        recipe_response = self.client.get(f'/api/recipes/{self.recipe.id}/')
        self.assertEqual(recipe_response.data['proportions_total'], '60.00')
        self.assertFalse(recipe_response.data['is_balanced'])

    def test_balanced_recipe_reports_is_balanced_true(self) -> None:
        other_ingredient = Ingredient.objects.create(owner=self.user, name='Sandalwood')
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=self.ingredient, proportion=Decimal('60'))
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=other_ingredient, proportion=Decimal('40'))

        response = self.client.get(f'/api/recipes/{self.recipe.id}/')
        self.assertEqual(response.data['proportions_total'], '100.00')
        self.assertTrue(response.data['is_balanced'])


class DerivedFieldForgeryTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username='formulator', password='password123')
        self.client.force_authenticate(user=self.user)
        self.recipe = Recipe.objects.create(
            owner=self.user,
            name='Citrus Bloom',
            default_concentration=Decimal('20'),
        )
        ingredient = Ingredient.objects.create(owner=self.user, name='Bergamot')
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=ingredient, proportion=Decimal('100'))

    def test_client_cannot_forge_derived_fields(self) -> None:
        response = self.client.post(
            '/api/batches/',
            {
                'recipe': self.recipe.id,
                'batch_size_g': '40',
                'made_on': str(timezone.localdate()),
                'aromatic_g': '999999.00',
                'diluent_g': '999999.00',
                'recipe_was_balanced': 'false',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['aromatic_g'], '8.00')
        self.assertEqual(response.data['diluent_g'], '32.00')
        self.assertTrue(response.data['recipe_was_balanced'])


class MacerationTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username='formulator', password='password123')
        self.client.force_authenticate(user=self.user)
        self.recipe = Recipe.objects.create(
            owner=self.user,
            name='Citrus Bloom',
            default_concentration=Decimal('20'),
            default_maceration_days=28,
        )
        ingredient = Ingredient.objects.create(owner=self.user, name='Bergamot')
        RecipeIngredient.objects.create(recipe=self.recipe, ingredient=ingredient, proportion=Decimal('100'))

    def _make_batch(self, made_on, maceration_days=28, status_value=Batch.STATUS_MACERATING) -> Batch:
        batch = Batch.objects.create(
            owner=self.user,
            recipe=self.recipe,
            batch_size_g=Decimal('40'),
            concentration=Decimal('20'),
            maceration_days=maceration_days,
            made_on=made_on,
            status=status_value,
        )
        batch.compute()
        return batch

    def test_overdue_batch_is_due(self) -> None:
        batch = self._make_batch(made_on=timezone.localdate() - timedelta(days=30))
        response = self.client.get(f'/api/batches/{batch.id}/')
        self.assertEqual(response.data['days_macerating'], 30)
        self.assertEqual(response.data['days_remaining'], -2)
        self.assertEqual(response.data['maceration_progress'], '100.00')
        self.assertTrue(response.data['is_due'])
        self.assertEqual(response.data['status'], Batch.STATUS_MACERATING)

    def test_status_does_not_auto_flip_when_overdue(self) -> None:
        batch = self._make_batch(made_on=timezone.localdate() - timedelta(days=30))
        batch.refresh_from_db()
        self.assertEqual(batch.status, Batch.STATUS_MACERATING)

    def test_ready_status_is_never_due_regardless_of_calendar(self) -> None:
        batch = self._make_batch(made_on=timezone.localdate() - timedelta(days=30), status_value=Batch.STATUS_READY)
        response = self.client.get(f'/api/batches/{batch.id}/')
        self.assertFalse(response.data['is_due'])

    def test_fresh_batch_is_not_due(self) -> None:
        batch = self._make_batch(made_on=timezone.localdate() - timedelta(days=10))
        response = self.client.get(f'/api/batches/{batch.id}/')
        self.assertFalse(response.data['is_due'])
        self.assertEqual(response.data['days_remaining'], 18)

    def test_maceration_progress_clamped_at_zero_for_future_made_on(self) -> None:
        batch = self._make_batch(made_on=timezone.localdate() + timedelta(days=5))
        response = self.client.get(f'/api/batches/{batch.id}/')
        self.assertEqual(response.data['maceration_progress'], '0.00')

    def test_is_due_filter_matches_serializer_is_due(self) -> None:
        due_batch = self._make_batch(made_on=timezone.localdate() - timedelta(days=30))
        fresh_batch = self._make_batch(made_on=timezone.localdate() - timedelta(days=10))

        due_response = self.client.get('/api/batches/?is_due=true')
        due_ids = {row['id'] for row in due_response.data['results']}
        self.assertIn(due_batch.id, due_ids)
        self.assertNotIn(fresh_batch.id, due_ids)

        not_due_response = self.client.get('/api/batches/?is_due=false')
        not_due_ids = {row['id'] for row in not_due_response.data['results']}
        self.assertIn(fresh_batch.id, not_due_ids)
        self.assertNotIn(due_batch.id, not_due_ids)


class RegistrationTests(APITestCase):
    def test_can_register_with_valid_credentials(self) -> None:
        response = self.client.post(
            '/api/register/',
            {
                'username': 'new_perfumer',
                'email': 'a@example.com',
                'password': 'Sn1ffTest!2026',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='new_perfumer').exists())
        self.assertNotIn('password', response.data)

    def test_weak_password_is_rejected(self) -> None:
        response = self.client.post(
            '/api/register/',
            {
                'username': 'new_perfumer',
                'email': 'a@example.com',
                'password': '12345678',
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class IngredientDeleteProtectionTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username='formulator', password='password123')
        self.client.force_authenticate(user=self.user)
        self.ingredient = Ingredient.objects.create(owner=self.user, name='Bergamot')

    def test_deleting_an_unused_ingredient_succeeds(self) -> None:
        response = self.client.delete(f'/api/ingredients/{self.ingredient.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Ingredient.objects.filter(id=self.ingredient.id).exists())

    def test_deleting_an_ingredient_used_in_a_recipe_returns_400_naming_the_recipe(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Citrus Bloom', default_concentration=Decimal('20'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.ingredient, proportion=Decimal('100'))

        response = self.client.delete(f'/api/ingredients/{self.ingredient.id}/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertIn('Citrus Bloom', response.data['detail'])
        self.assertTrue(Ingredient.objects.filter(id=self.ingredient.id).exists())

    def test_deleting_an_ingredient_used_in_a_batch_returns_400(self) -> None:
        recipe = Recipe.objects.create(owner=self.user, name='Citrus Bloom', default_concentration=Decimal('20'))
        RecipeIngredient.objects.create(recipe=recipe, ingredient=self.ingredient, proportion=Decimal('100'))
        batch = Batch.objects.create(
            owner=self.user,
            recipe=recipe,
            batch_size_g=Decimal('40'),
            concentration=Decimal('20'),
            maceration_days=28,
            made_on=timezone.localdate(),
        )
        batch.compute()

        response = self.client.delete(f'/api/ingredients/{self.ingredient.id}/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Citrus Bloom', response.data['detail'])
        self.assertTrue(Ingredient.objects.filter(id=self.ingredient.id).exists())
        self.assertFalse(User.objects.filter(username='new_perfumer').exists())


class _FixedRateThrottle(ai_views.AISummarizeThrottle):
    """Overrides the configured rate so tests can trip the limit without a slow window."""

    def get_rate(self) -> str:
        return '3/hour'


class AISummarizeNoteTests(APITestCase):
    def setUp(self) -> None:
        cache.clear()
        self.user_a = User.objects.create_user(username='user_a', password='password123')
        self.user_b = User.objects.create_user(username='user_b', password='password123')
        self.recipe = Recipe.objects.create(
            owner=self.user_a,
            name='Citrus Bloom',
            default_concentration=Decimal('20'),
        )
        self.batch = Batch.objects.create(
            owner=self.user_a,
            recipe=self.recipe,
            batch_size_g=Decimal('40'),
            concentration=Decimal('20'),
            maceration_days=28,
            made_on=timezone.localdate(),
        )
        self.batch.compute()
        self.note = BatchNote.objects.create(batch=self.batch, observed_on=timezone.localdate(), body='Smells great.')

    def test_unauthenticated_request_is_rejected(self) -> None:
        response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_user_note_id_returns_404(self) -> None:
        self.client.force_authenticate(user=self.user_b)
        response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_api_key_returns_503(self) -> None:
        os.environ.pop('GROQ_API_KEY', None)
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('formulations.ai.httpx.post')
    def test_successful_summary(self, mock_post) -> None:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'choices': [
                {'message': {'content': '{"summary": "Aging well.", "tags": ["citrus", "bright"]}'}},
            ],
        }

        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary'], 'Aging well.')
        self.assertEqual(response.data['tags'], ['citrus', 'bright'])

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('formulations.ai.httpx.post')
    def test_unparseable_groq_response_returns_502(self, mock_post) -> None:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'choices': [{'message': {'content': 'not json at all'}}],
        }

        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('formulations.ai.httpx.post')
    def test_missing_choices_in_groq_response_returns_502(self, mock_post) -> None:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {'choices': []}

        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch.object(ai_views.SummarizeNoteView, 'throttle_classes', [_FixedRateThrottle])
    @patch.dict('os.environ', {'GROQ_API_KEY': 'test-key'})
    @patch('formulations.ai.httpx.post')
    def test_throttle_is_attached_and_trips_after_limit(self, mock_post) -> None:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            'choices': [{'message': {'content': '{"summary": "ok", "tags": ["a"]}'}}],
        }

        self.client.force_authenticate(user=self.user_a)
        for _ in range(3):
            response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post('/api/ai/summarize-note/', {'note_id': self.note.id})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

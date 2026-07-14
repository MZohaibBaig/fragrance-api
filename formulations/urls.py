from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BatchNoteViewSet,
    BatchViewSet,
    IngredientViewSet,
    RecipeIngredientViewSet,
    RecipeViewSet,
)

router = DefaultRouter()
router.register(r'ingredients', IngredientViewSet, basename='ingredient')
router.register(r'recipes', RecipeViewSet, basename='recipe')
router.register(r'recipe-ingredients', RecipeIngredientViewSet, basename='recipe-ingredient')
router.register(r'batches', BatchViewSet, basename='batch')
router.register(r'batch-notes', BatchNoteViewSet, basename='batch-note')

urlpatterns = [
    path('', include(router.urls)),
]

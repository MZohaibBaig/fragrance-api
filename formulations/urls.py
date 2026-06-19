from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import IngredientViewSet, FormulaViewSet

router = DefaultRouter()
router.register(r'ingredients', IngredientViewSet, basename='ingredient')
router.register(r'formulas', FormulaViewSet, basename='formula')

urlpatterns = [
    path('', include(router.urls)),
]
from django.db.models import QuerySet
from rest_framework import viewsets, permissions
from rest_framework.serializers import BaseSerializer
from .models import Ingredient, Formula, FormulaIngredient
from .permissions import IsOwner
from .serializers import IngredientSerializer, FormulaSerializer, FormulaIngredientSerializer


class IngredientViewSet(viewsets.ModelViewSet):
    serializer_class = IngredientSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self) -> QuerySet[Ingredient]:
        return Ingredient.objects.filter(user=self.request.user)

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(user=self.request.user)


class FormulaViewSet(viewsets.ModelViewSet):
    serializer_class = FormulaSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self) -> QuerySet[Formula]:
        return Formula.objects.filter(user=self.request.user)

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(user=self.request.user)
import logging

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError, QuerySet
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from . import ai
from .filters import BatchFilterSet
from .models import Batch, BatchNote, Ingredient, Recipe, RecipeIngredient
from .permissions import IsOwner
from .serializers import (
    BatchNoteSerializer,
    BatchSerializer,
    IngredientSerializer,
    RecipeIngredientSerializer,
    RecipeSerializer,
)

logger = logging.getLogger(__name__)


class IngredientViewSet(viewsets.ModelViewSet):
    serializer_class = IngredientSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self) -> QuerySet[Ingredient]:
        if getattr(self, 'swagger_fake_view', False):
            return Ingredient.objects.none()
        return Ingredient.objects.filter(owner=self.request.user)

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(owner=self.request.user)

    def destroy(self, request, *args, **kwargs) -> Response:
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError as exc:
            recipe_names = set()
            for obj in exc.protected_objects:
                recipe = getattr(obj, 'recipe', None) or getattr(getattr(obj, 'batch', None), 'recipe', None)
                if recipe is not None:
                    recipe_names.add(recipe.name)
            if recipe_names:
                names = ', '.join(sorted(recipe_names))
                detail = f"Cannot delete '{instance.name}': still used in {names}."
            else:
                detail = f"Cannot delete '{instance.name}': it is still in use."
            return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecipeViewSet(viewsets.ModelViewSet):
    serializer_class = RecipeSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self) -> QuerySet[Recipe]:
        if getattr(self, 'swagger_fake_view', False):
            return Recipe.objects.none()
        return Recipe.objects.filter(owner=self.request.user).prefetch_related('recipe_ingredients__ingredient')


class RecipeIngredientViewSet(viewsets.ModelViewSet):
    serializer_class = RecipeIngredientSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['recipe']

    def get_queryset(self) -> QuerySet[RecipeIngredient]:
        if getattr(self, 'swagger_fake_view', False):
            return RecipeIngredient.objects.none()
        return RecipeIngredient.objects.filter(recipe__owner=self.request.user).select_related('ingredient', 'recipe')


class BatchViewSet(viewsets.ModelViewSet):
    serializer_class = BatchSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend]
    filterset_class = BatchFilterSet

    def get_queryset(self) -> QuerySet[Batch]:
        if getattr(self, 'swagger_fake_view', False):
            return Batch.objects.none()
        return (
            Batch.objects.filter(owner=self.request.user)
            .select_related('recipe')
            .prefetch_related('ingredients', 'notes')
            .order_by('-made_on', '-id')
        )

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(owner=self.request.user)


class BatchNoteViewSet(viewsets.ModelViewSet):
    serializer_class = BatchNoteSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['batch']

    def get_queryset(self) -> QuerySet[BatchNote]:
        if getattr(self, 'swagger_fake_view', False):
            return BatchNote.objects.none()
        return BatchNote.objects.filter(batch__owner=self.request.user).select_related('batch')


class AISummarizeThrottle(UserRateThrottle):
    scope = 'ai_summarize'


class SummarizeNoteSerializer(serializers.Serializer):
    note_id = serializers.IntegerField()


class SummarizeNoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AISummarizeThrottle]

    def post(self, request) -> Response:
        serializer = SummarizeNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        note = get_object_or_404(
            BatchNote.objects.select_related('batch'),
            id=serializer.validated_data['note_id'],
            batch__owner=request.user,
        )

        try:
            result = ai.summarize_note(note.body)
        except ai.AINotConfigured:
            logger.warning('AI summarize failed: not configured (user=%s)', request.user.username)
            return Response({'detail': 'AI not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ai.AIServiceError:
            logger.warning('AI summarize failed: Groq unavailable (user=%s)', request.user.username)
            return Response({'detail': 'AI service unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ai.AIResponseUnparseable:
            logger.warning('AI summarize failed: unparseable response (user=%s)', request.user.username)
            return Response({'detail': 'AI returned an unexpected response'}, status=status.HTTP_502_BAD_GATEWAY)

        logger.info('AI summarize succeeded for note=%s (user=%s)', note.id, request.user.username)
        return Response(result)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            logger.warning(
                'Registration rejected: weak password for username=%s',
                self.initial_data.get('username'),
            )
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def create(self, validated_data: dict) -> User:
        user = User.objects.create_user(**validated_data)
        logger.info('New user registered: %s', user.username)
        return user


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]

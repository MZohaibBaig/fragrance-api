from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import APIView


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request: Request, view: APIView, obj) -> bool:
        # Ingredient/Recipe/Batch own `owner` directly; RecipeIngredient and
        # BatchNote only have it via their parent `recipe`/`batch`.
        owner = getattr(obj, 'owner', None)
        if owner is None:
            parent = getattr(obj, 'recipe', None) or getattr(obj, 'batch', None)
            owner = getattr(parent, 'owner', None)
        return owner == request.user

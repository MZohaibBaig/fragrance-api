from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import APIView


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request: Request, view: APIView, obj) -> bool:
        return obj.user == request.user

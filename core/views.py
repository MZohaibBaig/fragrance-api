from django.db import DatabaseError, connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except DatabaseError:
        return JsonResponse({'status': 'error', 'database': 'unreachable'}, status=503)
    return JsonResponse({'status': 'ok'})


@require_GET
def robots_txt(request):
    return HttpResponse('User-agent: *\nDisallow: /', content_type='text/plain')

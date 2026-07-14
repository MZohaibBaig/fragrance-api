from datetime import timedelta

import django_filters
from django.db.models import DateField, DurationField, ExpressionWrapper, F, QuerySet
from django.utils import timezone

from .models import Batch


class BatchFilterSet(django_filters.FilterSet):
    is_due = django_filters.BooleanFilter(method='filter_is_due')

    class Meta:
        model = Batch
        fields = ['recipe', 'status']

    def filter_is_due(self, queryset: QuerySet, name: str, value: bool) -> QuerySet:
        today = timezone.localdate()
        annotated = queryset.annotate(
            ready_on=ExpressionWrapper(
                F('made_on')
                + ExpressionWrapper(F('maceration_days') * timedelta(days=1), output_field=DurationField()),
                output_field=DateField(),
            )
        )
        due_lookup = {'status': Batch.STATUS_MACERATING, 'ready_on__lte': today}
        if value:
            return annotated.filter(**due_lookup)
        return annotated.exclude(**due_lookup)

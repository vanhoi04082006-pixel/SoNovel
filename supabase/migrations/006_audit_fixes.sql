-- =====================================================================
-- Migration 006: bookmarks index + trigger fix + realtime cleanup
-- =====================================================================

-- §1: Thêm index cho bookmarks(user_id) — tránh full table scan
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);

-- §2: Fix chapters_sync_word_count trigger — xử lý UPDATE SET series_id
-- (sync with migration 004, schema.sql previously missed this edge case)
CREATE OR REPLACE FUNCTION public.chapters_sync_word_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalc_series_word_count(old.series_id);
    RETURN old;
  ELSE
    IF (TG_OP = 'UPDATE' AND old.series_id IS DISTINCT FROM new.series_id) THEN
      PERFORM public.recalc_series_word_count(old.series_id);
    END IF;
    PERFORM public.recalc_series_word_count(new.series_id);
    RETURN new;
  END IF;
END;
$$;

-- §3: Bớt series/chapters/tags khỏi realtime publication
-- (hook useRealtimeSync chỉ subscribe progress/favorites/history/bookmarks/user_settings)
ALTER PUBLICATION supabase_realtime DROP TABLE public.series;
ALTER PUBLICATION supabase_realtime DROP TABLE public.chapters;
ALTER PUBLICATION supabase_realtime DROP TABLE public.tags;

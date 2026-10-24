-- Rollback for 049_connect.sql (removes all NammaStay Connect data)
drop function if exists public.cn_status(uuid), public.cn_save_connection(uuid,text,text), public.cn_save_map(uuid,jsonb), public.cn_go_live(uuid),
  public.cn_pause(uuid,boolean), public.cn_delete(uuid), public.cn_admin_overview(), public.cn_admin_reservations(text,int),
  public.cn_admin_set_ota(text,boolean), public.cn_admin_retry(uuid), public.cn_admin_log(uuid,int),
  public._cn_conn_json(public.cn_connections), public._cn_log(uuid,text,text,boolean,text,text), public._cn_groups(uuid),
  public._cn_property_of(uuid), public._cn_require_property(uuid), public._cn_require_admin(), public._cn_admin();
drop table if exists public.cn_log, public.cn_reservations, public.cn_ota_rooms, public.cn_room_map, public.cn_connections, public.cn_otas;

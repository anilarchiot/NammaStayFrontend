export async function deleteSubscriber(rpc, storage, propertyId) {
  await rpc('admin_validate_subscriber_delete', { p_property: propertyId });
  let files = await rpc('admin_subscriber_files', { p_property: propertyId });
  while (files.length) {
    for (const bucket of new Set(files.map((file) => file.bucket))) {
      const paths = files.filter((file) => file.bucket === bucket).map((file) => file.path);
      const { error } = await storage.from(bucket).remove(paths);
      if (error) throw new Error(`Could not delete ${bucket} files: ${error.message}`);
    }
    const next = await rpc('admin_subscriber_files', { p_property: propertyId });
    if (next.length && next.some((file) => files.some((old) => old.bucket === file.bucket && old.path === file.path))) {
      throw new Error('Some property files could not be deleted. Check storage permissions and retry.');
    }
    files = next;
  }
  await rpc('admin_delete_subscriber', { p_property: propertyId });
}

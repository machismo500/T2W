import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { listRidePosts, type RidePost } from "@/api/posts";
import { uploadImage } from "@/api/upload";
import { useAuth } from "@/auth/AuthProvider";
import { useOutbox } from "@/outbox/useOutbox";
import { useIsOffline } from "@/lib/network";
import { colors, radius, spacing, text } from "@/theme";

export default function RidePostsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const auth = useAuth();
  const outbox = useOutbox();
  const offline = useIsOffline();
  const isPrivileged =
    auth.status === "authed" &&
    (auth.user.role === "superadmin" ||
      auth.user.role === "core_member" ||
      auth.user.role === "t2w_rider");

  const posts = useQuery({
    queryKey: ["ride-posts", id],
    queryFn: () => listRidePosts({ rideId: id, status: "approved" }),
  });

  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function addImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "T2W needs photo access.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      selectionLimit: 5 - images.length,
      allowsMultipleSelection: true,
    });
    if (r.canceled || r.assets.length === 0) return;
    setUploadBusy(true);
    try {
      const urls: string[] = [];
      for (const asset of r.assets) {
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
        );
        urls.push(await uploadImage(compressed.uri, "ride-post", { targetId: id }));
      }
      setImages((curr) => [...curr, ...urls].slice(0, 5));
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ride posts" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={posts.data?.items ?? []}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            isPrivileged ? (
              <View style={styles.composer}>
                <Text style={text.h3}>Share your photos</Text>
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder="What was the ride like?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.composerInput}
                />
                <ScrollView horizontal style={{ marginVertical: spacing.sm }}>
                  {images.map((u) => (
                    <Image key={u} source={{ uri: u }} style={styles.thumb} />
                  ))}
                  {images.length < 5 ? (
                    <Pressable onPress={addImage} style={styles.addThumb} disabled={uploadBusy}>
                      {uploadBusy ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Text style={{ color: colors.primary, fontSize: 28 }}>+</Text>
                      )}
                    </Pressable>
                  ) : null}
                </ScrollView>
                <Button
                  label="Post"
                  onPress={async () => {
                    if (!content.trim()) {
                      Alert.alert("Add a few words about the ride.");
                      return;
                    }
                    setSubmitting(true);
                    try {
                      await outbox.enqueue({
                        kind: "ride-post.create",
                        rideId: id,
                        body: { content: content.trim(), images },
                      });
                      setContent("");
                      setImages([]);
                      qc.invalidateQueries({ queryKey: ["ride-posts", id] });
                      Alert.alert(
                        offline ? "Saved" : "Posted",
                        offline
                          ? "You're offline — your post will publish when you're back online."
                          : isPrivileged &&
                              auth.status === "authed" &&
                              auth.user.role !== "t2w_rider"
                            ? "Your post is live."
                            : "Your post is pending moderation — it'll be visible once approved.",
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  loading={submitting}
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            posts.isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={text.bodySecondary}>No posts for this ride yet.</Text>
              </View>
            )
          }
          refreshing={posts.isRefetching}
          onRefresh={() => posts.refetch()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PostCard({ post }: { post: RidePost }) {
  return (
    <View style={styles.post}>
      <Text style={styles.author}>{post.authorName}</Text>
      {post.content ? <Text style={[text.body, { marginTop: spacing.xs }]}>{post.content}</Text> : null}
      {post.images.length > 0 ? (
        <ScrollView horizontal style={{ marginTop: spacing.sm }}>
          {post.images.map((u) => (
            <Image key={u} source={{ uri: u }} style={styles.postImage} />
          ))}
        </ScrollView>
      ) : null}
      <Text style={[text.caption, { marginTop: spacing.xs }]}>
        {new Date(post.createdAt).toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  composer: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  composerInput: {
    color: colors.textPrimary,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
  },
  thumb: { width: 72, height: 72, borderRadius: radius.md, marginRight: spacing.xs },
  addThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  post: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  author: { color: colors.primary, fontWeight: "700" },
  postImage: { width: 200, height: 200, borderRadius: radius.md, marginRight: spacing.xs },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
});

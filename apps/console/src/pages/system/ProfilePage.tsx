/**
 * User Profile Page
 *
 * Allows the authenticated user to view and edit their profile,
 * change their password, and manage account settings.
 */

import React, { useRef, useState } from 'react';
import { useAuth, getUserInitials } from '@object-ui/auth';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Alert,
  AlertDescription,
} from '@object-ui/components';
import { useUpload } from '@object-ui/providers';
import { CheckCircle2, AlertCircle, User, Lock, Upload, Loader2, X } from 'lucide-react';

export function ProfilePage() {
  const { user, updateUser, isLoading } = useAuth();
  const { upload } = useUpload();
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    try {
      await updateUser({ name });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const result = await upload(file);
      await updateUser({ image: result.url });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await updateUser({ image: null as unknown as string });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 max-w-2xl">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      {/* Avatar & Identity */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? 'User'} />
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold truncate">{user.name ?? 'User'}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <Badge variant="secondary" className="mt-1">{user.role ?? 'member'}</Badge>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
                data-testid="profile-avatar-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                data-testid="profile-avatar-upload-btn"
              >
                {avatarUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {user.image ? 'Replace' : 'Upload'}
              </Button>
              {user.image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={avatarUploading}
                  onClick={handleAvatarRemove}
                  data-testid="profile-avatar-remove-btn"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
          {avatarError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{avatarError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base sm:text-lg">Personal Information</CardTitle>
          </div>
          <CardDescription>Update your name and view account details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {saved && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-400">
                  Profile updated successfully.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                required
                aria-required="true"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                type="text"
                value={user.role ?? 'member'}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base sm:text-lg">Change Password</CardTitle>
          </div>
          <CardDescription>
            To change your password, use the password reset flow from the login page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

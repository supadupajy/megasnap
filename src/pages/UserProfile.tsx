"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  ChevronLeft, 
  UserPlus, 
  UserCheck, 
  Grid, 
  Video, 
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Loader2,
  User as UserIcon,
  Play
} from 'lucide-react';
import { Post, User } from '@/types';
import { cn, getYoutubeThumbnail } from '@/lib/utils';
import PostItem from '@/components/PostItem';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg';

const UserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');

  const toggleFollow = () => {
    setIsFollowing(!isFollowing);
    showSuccess(isFollowing ? '팔로우를 취소했습니다.' : '팔로우를 시작했습니다.');
  };

  const handleLikeToggle = (postId: string) => {
    setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 } : p));
  };

  const handleLocationClick = (e: React.MouseEvent, lat: number, lng: number) => {
    navigate('/', { state: { center: { lat, lng } } });
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        
        setUser(data);
        
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', id);
        
        if (postsError) throw postsError;
        
        setUserPosts(posts);
        
        const { data: saved, error: savedError } = await supabase
          .from('saved_posts')
          .select('*')
          .eq('user_id', id);
        
        if (savedError) throw savedError;
        
        setSavedPosts(saved);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <UserIcon className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">사용자를 찾을 수 없습니다</h2>
        <Button onClick={() => navigate(-1)} variant="outline">뒤로 가기</Button>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-white pb-28 no-scrollbar">
      <div className="pt-[88px]">
        <div className="px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h2 className="text-lg font-black text-gray-900">{user?.nickname || '탐험가'}</h2>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-yellow-400 to-indigo-600">
              <img src={user?.avatar_url || FALLBACK_IMAGE} alt="profile" className="w-full h-full rounded-full object-cover border-4 border-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-900 mb-1">{user?.nickname || '탐험가'}</h2>
              <p className="text-sm text-gray-500 mb-4">{user?.bio || "지도를 여행하는 탐험가 📍"}</p>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{userPosts.length}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Posts</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{user?.followers_count || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Followers</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{user?.following_count || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black">Following</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-8">
            <Button onClick={toggleFollow} className={cn("flex-1 rounded-xl font-bold h-11", isFollowing ? "bg-gray-100 hover:bg-gray-200 text-gray-900" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100")}>
              {isFollowing ? <><UserCheck className="w-4 h-4 mr-2" /> 팔로잉</> : <><UserPlus className="w-4 h-4 mr-2" /> 팔로우</>}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/chat/${id}`)} className="flex-1 rounded-xl font-bold h-11 border-gray-200">
              <MessageCircle className="w-4 h-4 mr-2" /> 메시지
            </Button>
          </div>

          <div className="flex border-b border-gray-100 mb-4">
            <button onClick={() => setActiveTab('posts')} className={cn("flex-1 py-3 flex justify-center", activeTab === 'posts' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Grid className="w-6 h-6" /></button>
            <button onClick={() => setActiveTab('saved')} className={cn("flex-1 py-3 flex justify-center", activeTab === 'saved' ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-300")}><Bookmark className="w-6 h-6" /></button>
          </div>

          <div className="flex flex-col -mx-6">
            {activeTab === 'saved' ? (
              <div className="px-6 flex flex-col gap-6">
                {savedPosts.map((post) => (
                  <PostItem 
                    key={post.id} 
                    post={post} 
                    onLikeToggle={() => handleLikeToggle(post.id)}
                    onLocationClick={handleLocationClick}
                  />
                ))}
                {savedPosts.length === 0 && <p className="text-center py-10 text-gray-400">저장된 게시물이 없습니다.</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {userPosts.map((post) => (
                  <PostItem 
                    key={post.id} 
                    post={post} 
                    onLikeToggle={() => handleLikeToggle(post.id)}
                    onLocationClick={handleLocationClick}
                  />
                ))}
                {userPosts.length === 0 && <p className="text-center py-10 text-gray-400">게시물이 없습니다.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
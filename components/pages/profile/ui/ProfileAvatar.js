import { UploadProfilePicture } from "@/components/pages/profile/ui/UploadProfilePicture";
import { User } from "lucide-react";
import Image from "next/image";

export function ProfileAvatar({ avatar }) {
  return (
    <>
      <div className="relative inline-block rounded-full border-4 border-tertiary">
        {avatar ? (
          <Image
            className="h-[160px] bg-background w-[160px] rounded-full object-cover object-center"
            src={avatar}
            alt="avatar"
            width={160}
            height={160}
          />
        ) : (
          <div className="h-[160px] w-[160px] rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-20 w-20 text-primary" />
          </div>
        )}
        <UploadProfilePicture />
      </div>
    </>
  );
}

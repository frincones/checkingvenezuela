"use client";

import { LayoutDashboard, User, BookCopy, CreditCard, Settings, HeadphonesIcon, LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { signOutAction } from "@/lib/actions";

import routes from "@/data/routes.json";

// Icon mapping for serializable data from server
const iconMap = {
  dashboard: <LayoutDashboard height={18} width={18} />,
  user: <User height={18} width={18} />,
  bookings: <BookCopy height={18} width={18} />,
  card: <CreditCard height={18} width={18} />,
  settings: <Settings height={18} width={18} />,
};
export function AvatarWithName({
  sideBarLinksUser,
  onlineStatus = "Online",
  profilePic = "",
  profileName = "John Doe",
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="focus-visible:ring-offset-[none]">
        <Button variant="link" className={"gap-2 text-inherit"}>
          <Avatar>
            {profilePic && <AvatarImage src={profilePic} className="rounded-full" />}
            <AvatarFallback className="bg-primary text-white font-bold">
              {profileName?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span>{profileName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={20}
        align="end"
        className="w-[300px] p-4 font-medium"
      >
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar className="h-[50px] w-[50px]">
              {profilePic && <AvatarImage src={profilePic} alt="profile_pic" className="rounded-full" />}
              <AvatarFallback className="bg-primary text-white font-bold text-lg">
                {profileName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{profileName}</p>
              <p className="text-sm opacity-75">{onlineStatus}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-4" />
        <DropdownMenuGroup>
          {sideBarLinksUser.map((option, index) => {
            return (
              <DropdownMenuItem
                key={index}
                asChild
                className="cursor-pointer justify-between"
              >
                <Link href={option.href}>
                  <div className="flex items-center gap-2">
                    {option.iconType ? iconMap[option.iconType] : option.icon}
                    <span>{option.title}</span>
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-4" />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer justify-between">
            <Link href={routes.support.path}>
              <div className="flex items-center gap-2">
                <HeadphonesIcon height={18} width={18} />
                <span>{routes.support.title}</span>
              </div>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <form action={signOutAction}>
              <Button
                variant="ghost"
                className={
                  "h-auto w-full justify-start gap-2 p-0 font-medium text-inherit"
                }
                type={"submit"}
              >
                <LogOut height={18} width={18} />
                <span>Logout</span>
              </Button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

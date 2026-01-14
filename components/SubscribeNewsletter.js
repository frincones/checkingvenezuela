"use client";

import Image from "next/image";
import { Input } from "@/components/local-ui/input";

import { isEmailValid } from "@/lib/utils";

import { useState, useEffect } from "react";
import { useFormState } from "react-dom";
import mailbox from "@/public/images/mailbox.svg";
import { subscribeAction } from "@/lib/actions";
import { SubmitBtn } from "./local-ui/SubmitBtn";

export function SubscribeNewsletter({ isSubscribed }) {
  const [state, dispatch] = useFormState(subscribeAction);
  const [subscribeNewsletterDom, setSubscribeNewsletterDom] = useState(null);
  const [height, setHeight] = useState(0);
  const [error, setError] = useState();
  const [subscribed, setSubscribed] = useState(isSubscribed);
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    const storedSubscribed = localStorage.getItem("subscribed");
    if (storedSubscribed) {
      setSubscribed(true);
    }
  }, []);

  useEffect(() => {
    const getId = document.getElementById("newsletter");
    setSubscribeNewsletterDom(getId);
    let h =
      subscribeNewsletterDom?.parentNode.clientHeight -
      subscribeNewsletterDom?.clientHeight / 2;

    function resize() {
      h =
        subscribeNewsletterDom?.parentNode.clientHeight -
        subscribeNewsletterDom?.clientHeight / 2;
      setHeight(isNaN(h) ? 500 : h);
    }

    setHeight(isNaN(h) ? 500 : h);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, [subscribeNewsletterDom]);

  useEffect(() => {
    if (state?.success === true) {
      setError();
      setSubscribed(true);
      localStorage.setItem("subscribed", true);
    } else {
      setError(state?.error);
    }
  }, [state?.success, state?.error]);

  function handleChange(e) {
    const isValid = e.target.value !== "" ? isEmailValid(e.target.value) : null;

    isValid === false && isValid !== null
      ? setError("please enter a valid email")
      : setError();
  }
  return (
    <>
      <section
        id="newsletter"
        className="relative z-10 mx-auto mb-[80px] flex h-[305px] w-[90%] items-end justify-between gap-[16px] rounded-[20px] bg-gradient-to-r from-[#FFD275] to-[#F2A93B] px-[24px] shadow-lg"
      >
        <div className="self-center">
          <h2 className="mb-[10px] text-[1.5rem] font-bold leading-[3.375rem] text-primary lg:text-[2.5rem] xl:text-[2.75rem]">
            Subscribe Newsletter
          </h2>
          <h3 className="mb-[8px] text-[1rem] font-bold text-primary/80 xl:text-[1.25rem]">
            The Travel
          </h3>
          <p className="mb-[16px] text-[0.875rem] font-medium text-primary/70 md:text-[1rem]">
            Get inspired! Receive travel discounts, tips and behind the scenes
            stories.
          </p>
          <div>
            {isMounted && subscribed ? (
              <h3 className="rounded-[8px] bg-primary px-[16px] py-[8px] text-xl font-bold text-white">
                Thank you for your subscription!!&nbsp;
              </h3>
            ) : (
              <form
                id={"subscribe"}
                action={dispatch}
                className="flex h-[40px] gap-[16px] lg:h-[56px]"
              >
                <Input
                  label={""}
                  error={error}
                  autoComplete="off"
                  name="subscribe-email"
                  type="email"
                  placeholder="Your email address"
                  onChange={handleChange}
                  className={"grow bg-white"}
                />

                <SubmitBtn
                  formId={"subscribe"}
                  variant={"default"}
                  customTitle={{
                    default: "Subscribe",
                    onSubmitting: "Subscibing...",
                  }}
                  className={
                    "h-full grow-0 bg-primary text-white hover:bg-primary/90 disabled:bg-[#737373] disabled:text-[#ffffff]"
                  }
                />
              </form>
            )}
          </div>
        </div>
        <div className="flex h-full items-end self-end max-md:hidden">
          <Image
            className="h-auto max-h-full"
            src={mailbox}
            alt="mailbox"
            width={500}
            height={500}
          />
        </div>
      </section>
      <div
        suppressHydrationWarning
        style={{
          position: "absolute",
          width: "100%",
          bottom: 0,
          background: "linear-gradient(180deg, #1B498B, #0A1A44)",
          height: height + "px",
        }}
      ></div>
    </>
  );
}

"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { Review } from "@/db/reviews";
import { Message } from "ai";
import { useRouter } from "next/navigation";

export default function Chat() {
  // Store review data that gets updated through conversation
  const [review, setReview] = useState<Partial<Review>>({});
  // Animation state for loading dots
  const [loadingDots, setLoadingDots] = useState(1);
  // State to track if review is complete (now set by API)
  const [isReviewComplete, setIsReviewComplete] = useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    api: "/api/create_review",
    body: {
      reviewState: review, // Pass the current review state with each message
    },
    onResponse: async (response) => {
      try {
        // Check if we can parse JSON from the response
        const responseText = await response.text();
        const data = JSON.parse(responseText);

        if (data.review) {
          // Filter out null fields for logging
          const nonNullReview = Object.fromEntries(
            Object.entries(data.review).filter(([, value]) => value !== null)
          );
          // Remove comment field from logging
          delete nonNullReview.comment;
          console.log("Current Review State");
          console.log(JSON.stringify(nonNullReview, null, 2));

          // Get the latest user message
          const lastUserMessage = messages[messages.length - 1]?.content || "";

          // Get follow-up question if available
          const followUpText = data.followUpQuestion
            ? typeof data.followUpQuestion === "object" &&
              data.followUpQuestion.text
              ? data.followUpQuestion.text
              : String(data.followUpQuestion)
            : "";

          // Create concatenated comment with user input and follow-up
          const currentComment = review.comment || "";
          const newComment = currentComment
            ? `${currentComment}\n\nUser: ${lastUserMessage}${
                followUpText ? `\nAI: ${followUpText}` : ""
              }`
            : `User: ${lastUserMessage}${
                followUpText ? `\nAI: ${followUpText}` : ""
              }`;

          // Update review with the concatenated comment and other data
          setReview((prevReview) => ({
            ...prevReview,
            ...data.review,
            comment: newComment,
          }));

          // Update review completion status from API
          if (data.isReviewComplete !== undefined) {
            setIsReviewComplete(data.isReviewComplete);
          }

          // If we have a follow-up question, add it as an assistant message
          if (data.followUpQuestion) {
            // Extract the question text - followUpQuestion might be a complex object
            const questionText =
              typeof data.followUpQuestion === "object" &&
              data.followUpQuestion.text
                ? data.followUpQuestion.text
                : String(data.followUpQuestion);

            const followupMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: questionText,
              parts: [{ type: "text", text: questionText }],
            };
            setMessages((prevMessages) => [...prevMessages, followupMessage]);
          }
        }

        // We return nothing to avoid adding a duplicate message
        // as we're manually adding it above
      } catch (error) {
        // If not JSON, handle as regular response
        console.error("Failed to parse response as JSON", error);
      }
    },
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Animate loading dots
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setLoadingDots((dots) => (dots % 3) + 1);
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const onSubmit = (e: FormEvent) => {
    handleSubmit(e);
  };

  // Also update comment when user submits a new message
  const handleFormSubmit = (e: FormEvent) => {
    if (input.trim()) {
      // Update comment with new user input before submission
      setReview((prevReview) => ({
        ...prevReview,
        comment: prevReview.comment
          ? `${prevReview.comment}\n\nUser: ${input}`
          : `User: ${input}`,
      }));
    }
    onSubmit(e);
  };

  const router = useRouter();

  useEffect(() => {
    // 환경 변수나 다른 조건에 따라 리다이렉션
    const landingVersion = process.env.NEXT_PUBLIC_LANDING_VERSION || "1";
    router.push(`/landing${landingVersion}`);
  }, [router]);

  return null; // 리다이렉션 중에는 아무것도 렌더링하지 않음
}

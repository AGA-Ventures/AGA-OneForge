import { Section, Text } from "@react-email/components";

export function Logo() {
  return (
    <Section className="mt-[32px]">
      <Text
        className="email-text mb-4 mx-auto text-center"
        style={{
          color: "#0e0e0e",
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "-0.5px",
          lineHeight: "36px",
          margin: "0 auto 16px"
        }}
      >
        AGA OneForge
      </Text>
    </Section>
  );
}

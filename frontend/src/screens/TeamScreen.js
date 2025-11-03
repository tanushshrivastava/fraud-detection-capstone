import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  Image,
  useWindowDimensions
} from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { spacing } from "@/styles/theme";

const engineers = [
  {
    name: "Tanush Shrivastava",
    role: "Backend Engineer",
    image: require("../../assets/team/Tanush-Shrivastava.png"),
    imageFilename: "Tanush-Shrivastava.png"
  },
  {
    name: "Mohammad Izzraff Janius",
    role: "Twillio/API Integration Engineer",
    image: require("../../assets/team/Mohammad-Janius.png"),
    imageFilename: "Mohammad-Janius.png"
  },
  {
    name: "Daniel Hsiao",
    role: "Model Engineer",
    image: require("../../assets/team/Daniel-Hsiao.png"),
    imageFilename: "Daniel-Hsiao.png"
  },
  {
    name: "Kavya Mathur",
    role: "UI Engineer",
    image: require("../../assets/team/Kavya-Mathur.png"),
    imageFilename: "Kavya-Mathur.png"
  }
];

const mentors = [
  {
    name: "Peter Daly",
    role: "Capital One Mentor",
    image: require("../../assets/team/Peter-Daly.png"),
    imageFilename: "Peter-Daly.png"
  },
  {
    name: "Jillian Jenova",
    role: "Capital One Mentor",
    image: require("../../assets/team/Jillian-Jenova.png"),
    imageFilename: "Jillian-Jenova.png"
  },
  {
    name: "Garret Huibregtse",
    role: "Capital One Mentor",
    image: require("../../assets/team/Garret-Huibregtse.png"),
    imageFilename: "Garret-Huibregtse.png"
  },
  {
    name: "Tyler Luedtke",
    role: "Capital One Mentor",
    image: require("../../assets/team/Tyler-Luedtke.png"),
    imageFilename: "Tyler-Luedtke.png"
  },
  {
    name: "Nolan Smith",
    role: "Capital One ",
    image: require("../../assets/team/Nolan-Smith.png"),
    imageFilename: "Nolan-Smith.png"
  }
];

const getInitials = (name) =>
  name
    .split(" ")
    .map((part) => (part && part[0] ? part[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();

const TeamMemberCard = ({ member }) => (
  <Card style={styles.card} mode="outlined">
    <View style={styles.cardInner}>
      {member.image ? (
        <Image source={member.image} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text variant="titleLarge" style={styles.initialsText}>
            {getInitials(member.name)}
          </Text>
          <Text variant="bodySmall" style={styles.placeholderCaption}>
            Add {member.imageFilename} to assets/team
          </Text>
        </View>
      )}
      <Text variant="titleMedium" style={styles.memberName}>
        {member.name}
      </Text>
      <Text variant="bodyMedium" style={styles.role}>
        {member.role}
      </Text>
    </View>
  </Card>
);

const TeamSection = ({ title, members }) => {
  const { width } = useWindowDimensions();
  const columnWidth = width >= 1280 ? "30%" : width >= 960 ? "32%" : width >= 640 ? "47%" : "100%";

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.cardGrid}>
        {members.map((member) => (
          <View key={member.name} style={[styles.cardWrapper, { width: columnWidth }]}>
            <TeamMemberCard member={member} />
          </View>
        ))}
      </View>
    </View>
  );
};

const TeamScreen = () => {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors?.background ?? "#F6F7FB" }
      ]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="headlineSmall" style={styles.title}>
          Meet the Team
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          We collaborate across engineering and mentorship to deliver trustworthy fraud
          intelligence.
        </Text>
        <TeamSection title="Engineering Team" members={engineers} />
        <TeamSection title="Mentor Panel" members={mentors} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeamScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  content: {
    padding: spacing(2),
    paddingBottom: spacing(4)
  },
  title: {
    marginBottom: spacing(0.5)
  },
  subtitle: {
    color: "rgba(31, 41, 51, 0.8)",
    marginBottom: spacing(2)
  },
  section: {
    marginBottom: spacing(3)
  },
  sectionTitle: {
    letterSpacing: 0.4,
    marginBottom: spacing(1)
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "stretch",
    marginHorizontal: -spacing(1)
  },
  cardWrapper: {
    paddingHorizontal: spacing(1),
    paddingBottom: spacing(2),
    maxWidth: 320,
    flexGrow: 1
  },
  card: {
    width: "100%",
    minWidth: 160,
    flexGrow: 1,
    borderRadius: 16,
    overflow: "hidden"
  },
  cardInner: {
    alignItems: "center",
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(2)
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.08)"
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(78, 115, 223, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.08)",
    padding: spacing(1)
  },
  initialsText: {
    fontWeight: "600",
    letterSpacing: 1,
    textAlign: "center"
  },
  placeholderCaption: {
    textAlign: "center",
    color: "rgba(31, 41, 51, 0.6)",
    marginTop: spacing(0.5)
  },
  memberName: {
    textAlign: "center",
    marginTop: spacing(1.5)
  },
  role: {
    color: "rgba(82, 96, 109, 0.9)",
    textAlign: "center",
    marginTop: spacing(0.5)
  }
});
